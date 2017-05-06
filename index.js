#!/bin/env node

"use strict"


var favicon = require('zlib').gzipSync(require('fs').readFileSync('website/favicon.ico')), //load the favicon into memory, and gzip it. the memory footprint is small, and it saves disk reads
    express = require('express'),
    fs = require('fs'),
    app = express(),
    request = require('request'),
    cors = require('cors')(),
    staticContent = express.static(process.cwd() + '/website'),
    http = require('https'),
    mime = require('mime'),
    rawURL = 'https://raw.githubusercontent.com',
    gistURL = 'https://gist.githubusercontent.com',
    cdnURL = 'cdn.gitcdn.link',
    cache = {},
    collectGarbageInterval = 15000



//Load the cache file, if it exists
try {
    cache = JSON.parse(fs.readFileSync('store-cache'))
}
catch(e) {}

//Start the garbage collection enforcer
setInterval(collectGarbage, collectGarbageInterval)


//create the return url
function createRedirectUrl (headers, meta, sha) {
    let scheme = (headers['cf-visitor'] && headers['cf-visitor'].scheme ? headers['cf-visitor'].scheme : 'https'),
        host = headers.host || cdnURL
        console.log(headers['cf-visitor'], scheme)

    return `${scheme}://${host}/cdn/${meta.user}/${meta.repo}/${sha}/${meta.filePath}`
}

//Used for debugging during development
function debugFunc (req, res, next) {

    console.log(req.headers)

    next()
}

//Serves the favicon accounting for it being pre gzipped
function faviconFunc (req, res) {
    res.setHeader('Content-Encoding', 'gzip')
    res.setHeader('Content-Type', 'image/x-icon')
    res.send(favicon)
}

//Serves the cdn route
function cdnFunc (req, res) {

    //Gets the path data
    let t = req.path.substr(4)


    req.pipe(http.request((t.split('/')[3] === 'raw' ? gistURL : rawURL) + t, function(newRes) {
        res.setHeader('Content-Type', mime.lookup(t))
        newRes.pipe(res)
    }).on('error', function(err) {
        res.statusCode = 500
        res.end()
        console.log(new Error('Status 500: couldn\'t pipe file to client || ' + meta.user + '/' + meta.repo + '/' +  body.sha + '/' + meta.filePath))
    }))
}

//Serves the repo route
function repoFunc (req, res) {
    var meta = {},
        refreshCache = false,
        options = {
            headers: {
                'User-Agent': 'request'
            }
        }

    /*Define the meta data*/
        meta.t = req.path.substr(6)
        meta.raw = meta.t.split('/')
        meta.user = meta.raw.shift()
        meta.repo = meta.raw.shift()
        meta.gist = (meta.raw[0] === 'raw' ? true : false)
        if (meta.gist) meta.raw.shift()
        meta.branch = meta.raw.shift()
        meta.filePath = meta.raw.join('/')

    /*Set the */
        options.url = 'https://api.github.com/' + (meta.gist ? 'gists' : 'repos') + '/' + (meta.gist ? '' : meta.user + '/') + meta.repo + (meta.gist ? '' : '/commits/' + meta.branch + '?client_id=' + process.env.gitcdn_clientid + '&client_secret=' + process.env.gitcdn_clientsecret)

    /*if the repo is cached, just send that back, and update it for next time*/
        if (cache[meta.user + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)]) {
            refreshCache = true
            lastCall(meta, cache[meta.user + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)], req, res)
        }

    /*Update the repo, and cache it*/
        request.get(options, function (err, r, rawBody) {
            var body
            if (rawBody) {
                try {
                    body = JSON.parse(rawBody)
                }
                catch (e) {
                    var err = new Error(e)
                    console.log(err)
                }
                if (meta.gist) meta.repo += '/raw'
                if (body && (body.sha || (body.history && body.history[0] && body.history[0].version))) lastCall(meta, body.sha || body.history[0].version, req, res, refreshCache)
                else{
                    if (!refreshCache) res.sendStatus(500)
                    var err = new Error('SHA1 hash is missing in /repo -> request: ' + req.path + ' JSON=' + JSON.stringify(body))
                    console.log(err)
                }
            }
            else {
                if (!refreshCache) res.sendStatus(500)
                var err = new Error('Status 500: ' + meta.user + '/' + meta.repo + '/' +  body.sha + '/' + meta.filePath)
                console.log(err)
            }
            meta = null
            options = null
        })
}

//Handles redirection and cacheing
function lastCall (meta, sha, req, res, cacheing) {
    if (sha && !cacheing) {
        var newUrl = createRedirectUrl(req.headers, meta, sha)
        cache[meta.user + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)] = sha
        res.redirect(301, newUrl)
    }
    else if (!!cacheing) {
        cache[meta.user + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)] = sha
    }
    else {
        if (!cacheing) res.sendStatus(500)
        var err = new Error('Status 500: SHA1 hash is missing in lastCall() || ' + meta.user + '/' + meta.repo + '/' +  sha + '/' + meta.filePath)
        console.log(err)
    }

    fs.writeFile('store-cache', JSON.stringify(cache))
}

//Does mandatory garbage collection at predefined intervals
function collectGarbage () {

    if (global.gc) global.gc()
}





//Set up the exprtess routes
if (process.env.NODE_ENV === 'development') app.use(debugFunc)
app.use('/favicon.ico', faviconFunc)//Serve the site icon
app.use('/', staticContent)
app.use(cors)
app.get('/cdn/*', cdnFunc)
app.get('/repo/*', repoFunc)
app.listen(process.env.PORT || 8080)

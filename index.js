#!/bin/env node

"use strict"


let favicon = require('zlib').gzipSync(require('fs').readFileSync('website/favicon.ico')), //load the favicon into memory, and gzip it. the memory footprint is small, and it saves disk reads
    express = require('express'),
    fs = require('fs'),
    app = express(),
    request = require('request'),
    cors = require('cors')(),
    port = process.env.PORT || 8080,
    /*Website Static Content Serving*/
    staticContent = express.static(process.cwd() + '/website'),
    staticContentAbout = express.static(process.cwd() + '/website/about'),
    staticContentDonate = express.static(process.cwd() + '/website/donate'),
    staticContentFAQ = express.static(process.cwd() + '/website/faq'),
    staticContentCDN = express.static(process.cwd() + '/website/cdn'),
    staticContentBlog = express.static(process.cwd() + '/website/blog'),
    staticContentSource = express.static(process.cwd() + '/website/open-source'),
    http = require('https'),
    mime = require('mime'),
    rawURL = 'https://raw.githubusercontent.com',
    gistURL = 'https://gist.githubusercontent.com',
    cdnURL = 'cdn.gitcdn.link',
    cache = {},
    blacklist = [],
    tempBlacklist = [],
    strikes = {},
    collectGarbageInterval = 15000,
    charsetOverrides = {
        'application/javascript': '; charset=utf-8',
        'text/css': '; charset=utf-8',
        'text/html': '; charset=utf-8',
        'text/plain': '; charset=utf-8',
        'application/json': '; charset=utf-8'
    }



//Load the cache file, if it exists
try {
    blacklist = JSON.parse(fs.readFileSync('blacklist.json'))
}
catch(e) {
    console.log("Error: blacklist.json missing")
}


//Start the garbage collection enforcer
setInterval(collectGarbage, collectGarbageInterval)


//create the return url
function createRedirectUrl (headers, meta, sha) {
    let scheme = (headers['cf-visitor'] && headers['cf-visitor'].scheme ? headers['cf-visitor'].scheme : 'https'),
        host = headers.host || cdnURL

    return `${scheme}://${host}/cdn/${meta.user}/${meta.repo}/${sha}/${meta.filePath}`
}

//Used for debugging during development
function debugFunc (req, res, next) {
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
    let t = req.originalUrl.substr(4),
    blacktlistTests = []
    for (var i in blacklist) {
        blacktlistTests.push(t.indexOf(blacklist[i]) > -1)
    }

   if (blacktlistTests.indexOf(true) > -1) {
        res.status(403).send("Forbidden - This repo/gist is on the blacklist. If you wish to appeal, please open an issue here: https://github.com/schme16/gitcdn.xyz/issues, with why you feel this repo should not be on the blacklist.")
        return false
    }
    else {
        req.pipe(http.request((t.split('/')[3] === 'raw' ? gistURL : rawURL) + t, function(newRes) {
            let mimeType = mime.lookup(t)
            res.setHeader('Content-Type', mimeType + (charsetOverrides[mimeType] || ''))
            res.setHeader("Cache-Control", "public, max-age=2592000");
            res.setHeader("Expires", new Date(Date.now() + 2592000000).toUTCString());

            newRes.pipe(res)
        }).on('error', function(err) {
            res.statusCode = 500
            res.end()
            console.log(new Error('Status 500: couldn\'t pipe file to client || ' + meta.user + '/' + meta.repo + '/' +  body.sha + '/' + meta.filePath))
        }))
    }
}

//Serves the repo route
function repoFunc (req, res) {
    let meta = {},
        refreshCache = false,
        options = {
            headers: {
                'User-Agent': 'request'
            }
        }

    /*Define the meta data*/
        meta.t = req.originalUrl.substr(6)
        meta.raw = meta.t.split('/')
        meta.user = meta.raw.shift()
        meta.repo = meta.raw.shift()
        meta.gist = (meta.raw[0] === 'raw' ? true : false)
        if (meta.gist) meta.raw.shift()
        meta.branch = meta.raw.shift()
        meta.filePath = meta.raw.join('/')

        let blacktlistTests = []
        for (var i in blacklist) {
            blacktlistTests.push(meta.user.indexOf(blacklist[i]) > -1)
            blacktlistTests.push(meta.user.indexOf(blacklist[i]) > -1)
            blacktlistTests.push(meta.repo.indexOf(blacklist[i]) > -1)
            blacktlistTests.push(meta.user.indexOf(blacklist[i] + '/' + meta.repo) > -1)
            blacktlistTests.push(meta.raw.indexOf(blacklist[i]) > -1)
            blacktlistTests.push(meta.branch.indexOf(blacklist[i]) > -1)
            blacktlistTests.push(meta.filePath.indexOf(blacklist[i]) > -1)
        }


    if (blacktlistTests.indexOf(true) > -1) {
        res.status(403).send("Forbidden - This repo/gist is on the blacklist. If you wish to appeal, please open an issue here: https://github.com/schme16/gitcdn.xyz/issues, with why you feel this repo should not be on the blacklist.")
        return false
    }
    else if ((!meta.repo && !meta.user) && !meta.gist) {
        res.sendStatus(404)
        return false
    }
    else {

        /*Set the */
            options.url = 'https://api.github.com/' + (meta.gist ? 'gists' : 'repos') + '/' + (meta.gist ? '' : meta.user + '/') + meta.repo + (meta.gist ? '' : '/commits/' + meta.branch + '?client_id=' + process.env.gitcdn_clientid + '&client_secret=' + process.env.gitcdn_clientsecret)

        /*if the repo is cached, just send that back, and update it for next time*/
            if (cache[meta.user + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)]) {
                refreshCache = true
                lastCall(meta, cache[meta.user + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)], req, res)
            }

        /*Update the repo, and cache it*/
            request.get(options, function (err, r, rawBody) {
                let body
                if (rawBody) {
                    try {
                        body = JSON.parse(rawBody)
                    }
                    catch (e) {
                        console.log("Error: ", e)
                    }
                    if (meta.gist) meta.repo += '/raw'
                    if (body && (body.sha || (body.history && body.history[0] && body.history[0].version))) {
                        lastCall(meta, body.sha || body.history[0].version, req, res, refreshCache)
                    }
                    else { //Error
                        if (!refreshCache) res.sendStatus(500)
                        console.log("Error: " + 'SHA1 hash is missing in /repo -> request: ' + req.originalUrl + ' JSON=' + JSON.stringify(body))

                        strikes[meta.filePath] = strikes[meta.filePath] || 0
                        if (strikes[meta.filePath] >= 10) {
                            //tempBlacklist.push(meta.filePath)//meta.user + '/' + meta.repo)
                        }
                        else {
                            strikes[meta.filePath]++
                        }


                    }
                }
                else { //Error
                    if (!refreshCache) res.sendStatus(500)
                    console.log("Error: " + 'Status 500: ' + meta.user + '/' + meta.repo + '/' +  body.sha + '/' + meta.filePath)

                }
                meta = null
                options = null
            })
        
    }
}

//Handles redirection and cacheing
function lastCall (meta, sha, req, res, cacheing) {
    if (sha && !cacheing) {
        let newUrl = createRedirectUrl(req.headers, meta, sha)
        cache[meta.user + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)] = sha
        res.redirect(301, newUrl)
    }
    else if (!!cacheing) {
        cache[meta.user + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)] = sha
    }
    else {
        if (!cacheing) res.sendStatus(500)
        console.log("Error: " + 'Status 500: SHA1 hash is missing in lastCall() || ' + meta.user + '/' + meta.repo + '/' +  sha + '/' + meta.filePath)
       //tempBlacklist.push(meta.filePath)//meta.user + '/' + meta.repo)
    }
}

//Does mandatory garbage collection at predefined intervals
function collectGarbage () {

    if (global.gc) global.gc()
}



//Experimental - Hopeing to reduce the downtime posibly casued by memory limits
setTimeout(function () {
    cache = {}
    collectGarbage()
    setTimeout(collectGarbage, 10000)
}, 4.32e+7)


//Set up the exprtess routes
if (process.env.NODE_ENV === 'development') app.use(debugFunc)

app.set('etag', 'strong') // use strong etags

app.use('/favicon.ico', faviconFunc)//Serve the site icon
app.use('/', staticContent)
app.use('/About', staticContentAbout)
app.use('/FAQ', staticContentFAQ)
app.use('/Donate', staticContentDonate)
app.use('/Blog', staticContentBlog)
app.use('/CDN', staticContentCDN)
app.use('/Open-Source', staticContentSource)
app.use('/about', staticContentAbout)
app.use('/faq', staticContentFAQ)
app.use('/donate', staticContentDonate)
app.use('/blog', staticContentBlog)
app.use('/cdn', staticContentCDN)
app.use('/open-source', staticContentSource)
app.use(cors)
app.get('/cdn/*', cdnFunc)
app.use('/repo/*', repoFunc)
app.listen(port)

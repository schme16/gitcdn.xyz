#!/bin/env node

//Send http data to keymetrics.io
pmx = require('pmx');
pmx.init();


function lastCall (meta, sha, req, res, cacheing) {
    if (sha && !cacheing) {
        var newUrl = 'https://gitcdn' + (req.get('host').indexOf('min.gitcdn.xyz') !== -1 ? 'min' : '') + '-17ac.kxcdn.com/cdn/' + meta.user + '/' + meta.repo + '/' +  sha + '/' + meta.filePath;
        cache[meta.user + '/' + meta.repo] = sha;
        res.redirect(301, newUrl)
    }
    else if (!!cacheing) {
        cache[meta.user + '/' + meta.repo] = sha;
    }
    else {
        if (!cacheing) res.sendStatus(500);
        var err = new Error('Status 500: SHA1 hash is missing in lastCall() || ' + meta.user + '/' + meta.repo + '/' +  sha + '/' + meta.filePath);
        pmx.notify(err);
    }

    fs.writeFile('store-cache', JSON.stringify(cache))
};

var express = require('express'),

fs = require('fs'),

app = express(),

request = require('request'),

cors = require('cors'),

http = require('https'),

mime = require('mime'),

cache = {};
try {
    cache = JSON.parse(fs.readFileSync('store-cache'));
}
catch(e) {}


app.use('/', express.static(process.cwd() + '/website'))

app.use(cors());

app.get('/cdn/*', function (req, res) {
    var t = req.path.substr(4)
    var url = 'https://raw.githubusercontent.com' + t;

    req.pipe(http.request(url, function(newRes) {
        res.setHeader('Content-Type', mime.lookup(url));
        newRes.pipe(res);
    }).on('error', function(err) {
        res.statusCode = 500;
        res.end();

        var err = new Error('Status 500: couldn\'t pipe file to client || ' + meta.user + '/' + meta.repo + '/' +  body.sha + '/' + meta.filePath);
        pmx.notify(err);
    }));
});

app.get('/repo/*', function (req, res) {
    var meta = {},
        refreshCache = false,
        options = {
            headers: {
                'User-Agent': 'request'
            }
        };

    /*Define the meta data*/
        meta.t = req.path.substr(6);
        meta.raw = meta.t.split('/');
        meta.user = meta.raw.shift();
        meta.repo = meta.raw.shift();
        meta.branch = meta.raw.shift();
        meta.filePath = meta.raw.join('/');

    /*Set the */
        options.url = 'https://api.github.com/repos/' + meta.user + '/' + meta.repo + '/commits/master';

    /*if the repo is cached, just send that back, and update it for next time*/
        if (cache[meta.user + '/' + meta.repo]) {
            refreshCache = true;
            lastCall(meta, cache[meta.user + '/' + meta.repo], req, res);
        }

    /*Update the repo, and cache it*/
        request.get(options, function (err, r, rawBody) {
            var body;
            if (rawBody) {
                try {
                    body = JSON.parse(rawBody);
                }
                catch (e) {
                    var err = new Error(e);
                    pmx.notify(err);
                }

                if (body && body.sha) lastCall(meta, body.sha, req, res, refreshCache);
                else{
                    if (!refreshCache) res.sendStatus(500)
                    var err = new Error('SHA1 hash is missing in /repo -> request: ' + meta.user + '/' + meta.repo + '/' +  body.sha + '/' + meta.filePath);
                    pmx.notify(err);
                }
            }
            else {
                if (!refreshCache) res.sendStatus(500)
                var err = new Error('Status 500: ' + meta.user + '/' + meta.repo + '/' +  body.sha + '/' + meta.filePath);
                pmx.notify(err);
            }
            meta = null;
            options = null;
        })
})




//Send error data to keymetrics.io
app.use(pmx.expressErrorHandler());

app.listen(process.env.OPENSHIFT_NODEJS_PORT || 8080, process.env.OPENSHIFT_NODEJS_IP);

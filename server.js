#!/bin/env node

//Send http data to keymetrics.io
pmx = require('pmx');
pmx.init();


express = require('express');

fs = require('fs');

app = express();

request = require('request');

cors = require('cors');

http = require('https');

mime = require('mime');

options = {
    headers: {
        'User-Agent': 'request'
    }
};

cache = {}



app.use(cors());

app.get('/cdn/*', function (req, res) {
    var t = req.path.substr(4)
    var url = 'https://raw.githubusercontent.com' + t;
    /*        res.setHeader('Content-Type', mime.lookup(url));
    options.url = url;
    request.get(options, function (err, r, rawBody) {
        res.send(rawBody);
    })*/

    req.pipe(http.request(url, function(newRes) {
        res.setHeader('Content-Type', mime.lookup(url));
        newRes.pipe(res);
    }).on('error', function(err) {
        res.statusCode = 500;
        res.end();
    }));
});

var lastCall = function (meta, body, req, res, cacheing) {
    if (body && !cacheing) {
        var newUrl = 'https://gitcdn' + (req.get('host').indexOf('min.gitcdn.xyz') !== -1 ? 'min' : '') + '-17ac.kxcdn.com/cdn/' + meta.user + '/' + meta.repo + '/' +  body.sha + '/' + meta.filePath;
        cache[meta.t] = body;
        res.setHeader('Content-Type', mime.lookup(newUrl));
        res.redirect(301, newUrl)
    }
    else if (!!cacheing) {
        cache[meta.t] = body;
    }
    else {
        res.sendStatus(500)
    }
}

app.get('/repo/*', function (req, res) {
    var meta = {};
        meta.t = req.path.substr(6)
        meta.raw = meta.t.split('/'),
        meta.user = meta.raw.shift(),
        meta.repo = meta.raw.shift(),
        meta.branch = meta.raw.shift(),
        meta.filePath = meta.raw.join('/'),
        refreshCache = false;
    options.url = 'https://api.github.com/repos/' + meta.user + '/' + meta.repo + '/commits/master';
    if (cache[meta.t]) {
        refreshCache = true;
        lastCall(meta, cache[meta.t], req, res);
    }
    request.get(options, function (err, r, rawBody) {
        var body;
        if (rawBody) {


            try {
                body = JSON.parse(rawBody);
            }
            catch (e) {
                console.log(e)
            }

            lastCall(meta, body, req, res, refreshCache);

        }
        else {
            if (!refreshCache) res.sendStatus(500)
        }
    })
})

app.use('/', express.static(process.cwd() + '/website'))

//Send error data to keymetrics.io
app.use(pmx.expressErrorHandler());

app.listen(process.env.OPENSHIFT_NODEJS_PORT || 8080, process.env.OPENSHIFT_NODEJS_IP);

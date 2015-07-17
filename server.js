#!/bin/env node

//Send http data to keymetrics.io
pmx = require('pmx');
pmx.init();

favicon = require('zlib').gzipSync(require('fs').readFileSync('website/favicon.ico'))

function lastCall (meta, sha, req, res, cacheing) {
    if (sha && !cacheing) {
        var newUrl = cdnURL + meta.user + '/' + meta.repo + '/' +  sha + '/' + meta.filePath;
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

rawURL = 'https://raw.githubusercontent.com',

gistURL = 'https://gist.githubusercontent.com',

cdnURL = 'https://cdn.gitcdn.xyz/cdn/',

//cdnURL = 'http://localhost:8080/cdn/',

cache = {};
try {
    cache = JSON.parse(fs.readFileSync('store-cache'));
}
catch(e) {}

var test_string = 'Hello';



pmx.action('cache:empty', function(reply) {
    cache = {};
    fs.writeFile('store-cache', JSON.stringify(cache))
    reply({success : true});
});

app.use('/hello', function (request, response) {
   request = null;
   response.send(test_string);
})

/*Serve the site icon*/
app.use('/favicon.ico', function (req, res) {
	res.setHeader('Content-Encoding', 'gzip');
	res.setHeader('Content-Type', 'image/x-icon');
	res.send(favicon);
})



app.use('/', express.static(process.cwd() + '/website'))

app.use(cors());

app.get('/cdn/*', function (req, res) {
    var t = req.path.substr(4);

    req.pipe(http.request((t.split('/')[3] === 'raw' ? gistURL : rawURL) + t, function(newRes) {
        res.setHeader('Content-Type', mime.lookup(t));
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
        meta.repo = meta.raw.shift()
        meta.gist = (meta.raw[0] === 'raw' ? true : false);
        if (meta.gist)/* meta.repo += */meta.raw.shift();
        meta.branch = meta.raw.shift();
        meta.filePath = meta.raw.join('/');

    /*Set the */
        options.url = 'https://api.github.com/' + (meta.gist ? 'gists' : 'repos') + '/' + (meta.gist ? '' : meta.user + '/') + meta.repo + (meta.gist ? '' : '/commits/master?client_id=1f21f89a93c52a69cfcd&client_secret=3036adac62bee3029424210d8a7cdd85ab79cd36');

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
                if (meta.gist) meta.repo += '/raw';
                if (body && (body.sha || (body.history && body.history[0] && body.history[0].version))) lastCall(meta, body.sha || body.history[0].version, req, res, refreshCache);
                else{
                    if (!refreshCache) res.sendStatus(500)
                    var err = new Error('SHA1 hash is missing in /repo -> request: ' + req.path + '; JSON=' + JSON.stringify(body));
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




//console.log(global)
setInterval(global.gc, 1000)


//Send error data to keymetrics.io
app.use(pmx.expressErrorHandler());

app.listen(8080);

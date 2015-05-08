#!/bin/env node

var express = require('express'),
request = require('request')
fs = require('fs')
app = express(),
parse = require('parse-github-url');
mime = require('mime');


var options = {
  headers: {
    'User-Agent': 'request'
  }
};


 
 

function getUrls(urlEl) {

    var REGEX_GIST_URL = /^(https?):\/\/gist\.github\.com\/(.+?)\/([^\/]+)/i,
        REGEX_RAW_URL  = /^(https?):\/\/(?:gist|raw)\.github(?:usercontent)?\.com\/([^\/]+\/[^\/]+\/[^\/]+|[0-9A-Za-z-]+\/[0-9a-f]+\/raw)\/(.+)/i,
        REGEX_REPO_URL = /^(https?):\/\/github\.com\/(.+?)\/(.+?)\/(?:(?:blob|raw)\/)?(.+?\/.+)/i,
        devDomain = 'rawgit.com',
        cdnDomain = 'cdn.rawgit.com',
        url = decodeURIComponent(urlEl.trim()),
        devEl = false,
        prodEl = false;


    if (REGEX_RAW_URL.test(url)) {
        devEl = encodeURI(url.replace(REGEX_RAW_URL, '$1://' + devDomain + '/$2/$3'));
        prodEl = encodeURI(url.replace(REGEX_RAW_URL, '$1://' + cdnDomain + '/$2/$3'));
    }
    else if (REGEX_REPO_URL.test(url)) {
        devEl = encodeURI(url.replace(REGEX_REPO_URL, '$1://' + devDomain + '/$2/$3/$4'));
        prodEl = encodeURI(url.replace(REGEX_REPO_URL, '$1://' + cdnDomain + '/$2/$3/$4'));
    }
    else if (REGEX_GIST_URL.test(url)) {
        devEl = encodeURI(url.replace(REGEX_GIST_URL, '$1://' + devDomain + '/$2/$3/raw/'));
        prodEl = encodeURI(url.replace(REGEX_GIST_URL, '$1://' + cdnDomain + '/$2/$3/raw/'));
    }
    else {
        if (url.length === 0) {
            devEl = false;
            prodEl = false;
        }
    }

    return {
        dev: devEl,
        prod: prodEl
    }
}







app.get('/getfile/*', function (req, res) {

    var file = 'https://raw.githubusercontent.com/USQ-Media-Services/snazzy' + (req.path.replace('/getfile', ''));//,
    options.url = file;
    request.get(options, function (err, r, rawBody) {
        if (rawBody) {
            res.setHeader('Content-Type', mime.lookup(file))
            res.send(rawBody);
        }
        else {
            res.sendStatus(500)
        }
    })

});

app.get('/cdn/*', function (req, res) {
    options.url = 'https://api.github.com/repos/USQ-Media-Services/snazzy/commits/master';
    request.get(options, function (err, r, rawBody) {
        var body;
        if (rawBody) {
            try {
                body = JSON.parse(rawBody);
            }
            catch (e) {
                console.log(e)
            }
            if (body) {
                res.redirect(301, '/getfile/' +  body.sha + (req.path.replace('/cdn','')))
            }
            else {
                res.sendStatus(500)
            }
        }
        else {
            res.sendStatus(500)
        }
    })
})


app.listen(process.env.OPENSHIFT_NODEJS_PORT || 8080, process.env.OPENSHIFT_NODEJS_IP);

#!/bin/env node

//get http data 
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


app.get('/repo/*', function (req, res) {
    var t = req.path.substr(6)
        raw = t.split('/'),
        user = raw.shift(),
        repo = raw.shift(),
        branch = raw.shift(),
        filePath = raw.join('/');
        console.log(user, repo, branch, filePath);

    options.url = 'https://api.github.com/repos/' + user + '/' + repo + '/commits/master';
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
                var newUrl = '/cdn/' + user + '/' + repo + '/' +  body.sha + '/' + filePath;
                res.setHeader('Content-Type', mime.lookup(newUrl));
                res.redirect(301, newUrl)
                //res.send(newUrl)
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

app.use('/', express.static(process.cwd() + '/website'))


app.use(pmx.expressErrorHandler());

app.listen(process.env.OPENSHIFT_NODEJS_PORT || 8080, process.env.OPENSHIFT_NODEJS_IP);

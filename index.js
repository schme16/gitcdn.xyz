#!/bin/env node

"use strict"


let favicon = require('zlib').gzipSync(require('fs').readFileSync('website/favicon.ico')), //load the favicon into memory, and gzip it. the memory footprint is small, and it saves disk reads
	express = require('express'),
	fs = require('fs'),
	{ Octokit } = require("@octokit/rest"),
	{ retry } = require("@octokit/plugin-retry"),
	{ throttling } = require("@octokit/plugin-throttling"),
	app = express(),
	request = require('request'),
	cors = require('cors'),
	port = process.env.PORT || 8080,
	staticContent = express.static(process.cwd() + '/website'),
	http = require('https'),
	mime = require('mime'),
	rawURL = 'https://raw.githubusercontent.com',
	gistURL = 'https://gist.githubusercontent.com',
	cdnURL = 'cdn.gitcdn.xyz',
	cache = {},
	maxCacheLife = 7.2e+6, //This is about 2 hrs in milliseconds
	blacklist = [],
	tempBlacklist = [],
	strikes = {},
	charsetOverrides = {
		'application/javascript': '; charset=utf-8',
		'text/css': '; charset=utf-8',
		'text/html': '; charset=utf-8',
		'text/plain': '; charset=utf-8',
		'application/json': '; charset=utf-8'
	},

	MyOctokit = Octokit.plugin(retry, throttling),
	octokit = new MyOctokit({
		auth: process.env.accessToken,
		throttle: {
			onRateLimit: (retryAfter, options) => {
				myOctokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)

				if (options.request.retryCount === 0) {
					// only retries once
					myOctokit.log.info(`Retrying after ${retryAfter} seconds!`)
					return true
				}
			},
			onAbuseLimit: (retryAfter, options) => {
				// does not retry, only logs a warning
				myOctokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`)
			},
		},
		log: {
			debug: () => {},
			info: () => {},
			warn: console.warn,
			error: console.error
		},
		timeZone: 'Australia/Brisbane',

		userAgent: 'GitCDN.xyz 2.0.0',

	}),


	//create the return url
	createRedirectUrl = (headers, meta, sha)  => {
		let scheme = (headers['cf-visitor'] && headers['cf-visitor'].scheme ? headers['cf-visitor'].scheme : 'https'),
			host = headers.host || cdnURL
		return `${scheme}://${host}/cdn/${meta.user}/${meta.repo}/${sha}/${meta.filePath}`
	},

	//Used for debugging during development
	debugFunc = (req, res, next)  => {
		next()
	},

	//Serves the favicon accounting for it being pre gzipped
	faviconFunc = (req, res)  => {
		res.setHeader('Content-Encoding', 'gzip')
		res.setHeader('Content-Type', 'image/x-icon')
		res.send(favicon)
	},

	//Serves the cdn route
	cdnFunc = (req, res)  => {

		//Gets the meta
		let meta = getMeta(req.originalUrl) /*Define the meta data*/

		if (meta.blacklisted) {
			res.status(403).send("Forbidden - This repo/gist is on the blacklist. If you wish to appeal, please open an issue here: https://github.com/schme16/gitcdn.xyz/issues, with why you feel this repo should not be on the blacklist.")
			return false
		}
		else {
			console.log(234234234)
			//TODO: re-write the data fetch request
			/*req.pipe(http.request((t.split('/')[3] === 'raw' ? gistURL : rawURL) + t, function(newRes)  => {
				let mimeType = mime.lookup(t)
				res.setHeader('Content-Type', mimeType + (charsetOverrides[mimeType] || ''))
				res.setHeader("Cache-Control", "public, max-age=2592000");
				res.setHeader("Expires", new Date(Date.now() + 2592000000).toUTCString());
	
				newRes.pipe(res)
			}).on('error', function(err)  => {
				res.statusCode = 500
				res.end()
				console.log(new Error('Status 500: couldn\'t pipe file to client || ' + meta.user + '/' + meta.repo + '/' +  body.sha + '/' + meta.filePath))
			}))*/
		}
	},
	
	//Fetch all the metadata for the requested url
	getMeta = (oUrl) => {
		let meta = {},
			blacktlistTests = []

		//The base split
		meta.t = oUrl.substr(6)
		
		//The raw url
		meta.raw = meta.t.split('/')
		
		//The repo owner
		meta.owner = meta.raw.shift()
		
		//The repo to look at
		meta.repo = meta.raw.shift()
		
		//Is this a gist?
		meta.gist = (meta.raw[0] === 'raw' ? true : false)
		
		//If it IS a gist add the raw field
		if (meta.gist) meta.raw.shift()
		
		//Add the branch field
		meta.branch = meta.raw.shift()
		
		//Add the file we're asking for
		meta.filePath = meta.raw.join('/')
		
		//Defaults to no blacklisted
		meta.blacklisted = false 
			
		//Check if this owner/repo/branch/gist/file is blacklisted
		for (var i in blacklist) {
			meta.blacklisted = meta.owner.indexOf(blacklist[i]) > -1 || 
			meta.repo.indexOf(blacklist[i]) > -1 ||
			meta.owner.indexOf(blacklist[i] + '/' + meta.repo) > -1 ||
			meta.raw.indexOf(blacklist[i]) > -1 ||
			meta.branch.indexOf(blacklist[i]) > -1 ||
			meta.filePath.indexOf(blacklist[i]) > -1
			if (meta.blacklisted) break;
		}
		
		return meta
	}, 

	//Serves the repo route
	repoFunc = (req, res)  => {
	
		let meta = getMeta(req.originalUrl), /*Define the meta data*/
			cached = cache[meta.user + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)],
			refreshCache = !cached || new Date().getTime() - cached.timestamp > maxCacheLife //Should we force a cache refresh

		if (meta.blacklisted) {
			res.status(403).send("Forbidden - This repo/gist is on the blacklist. If you wish to appeal, please open an issue here: https://github.com/schme16/gitcdn.xyz/issues, with why you feel this repo should not be on the blacklist.")
			return false
		}
		else if ((!meta.repo && !meta.owner) && !meta.gist) {
			res.sendStatus(404)
			return false
		}
		else {

			/*If the repo is cached, just send that back, and update it for next time*/
			if (!refreshCache) {
				lastCall(meta, cached.sha, req, res)
			}
			
			//Ok, either the cache is older than the max cache life, or no cache was found. Lets fetch it!
			else {
				console.log(meta)
				octokit.repos.getCommit({
					owner: meta.owner,
					repo: meta.repo,
					commit_sha: 'master'
				})
				.then((commit) => {
					console.log(3242342342)
					let body = commit.data 
					cache[meta.owner + '/' + meta.repo + (meta.gist ? '' : '/' + meta.branch)] = {
						sha: meta.sha,
						timestamp: new Date().getTime()
					}
					lastCall(meta, body.sha, req, res, refreshCache)
				})
				.catch((err) => {
					console.log(err)
					if (err) res.sendStatus(404)
					
				})
			}
		}
	},

	//Handles redirection and cacheing
	lastCall = (meta, sha, req, res, caching)  => {
		console.log(11111)
		if (sha) {
		console.log(22222)
			let newUrl = createRedirectUrl(req.headers, meta, sha)
			res.redirect(301, newUrl)
		}
		else {
		console.log(33333)
			res.sendStatus(404)
		}
	}



//Set up the exprtess routes
if (process.env.NODE_ENV === 'production') app.use(debugFunc)

app.set('etag', 'strong') // use strong etags

app.use('/favicon.ico', faviconFunc)//Serve the site icon
app.use('/', staticContent)
app.use(cors())
app.get('/cdn/*', cdnFunc)
app.use('/repo/*', repoFunc)



//Load the blacklist cache file, if it exists
blacklist = fs.readFile(__dirname + '/blacklist.json', (err, data) => {
	if (!err) {
		blacklist = JSON.parse(data)
	}
	else {
		blacklist = []
		fs.writeFile(__dirname + '/blacklist.json', JSON.stringify(blacklist), () => {
			console.log('Created a blacklist file')
		})
	}

	console.log(`App started on port: ${port}`)
	app.listen(port)
})


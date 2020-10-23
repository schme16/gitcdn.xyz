#!/bin/env node

"use strict"


let favicon = require('zlib').gzipSync(require('fs').readFileSync('website/favicon.ico')), //load the favicon into memory, and gzip it. the memory footprint is small, and it saves disk reads
	express = require('express'),
	fs = require('fs'),
	app = express(),
    request = require('request'),
    git = require('simple-git')(),
	cors = require('cors'),
	port = process.env.PORT || 8080,
	staticContent = express.static(process.cwd() + '/website'),
	http = require('https'),
	mime = require('mime'),
	rawURL = 'https://raw.githubusercontent.com',
	gistURL = 'https://gist.githubusercontent.com',
	cdnURL = 'cdn.gitcdn.xyz',
	garbageCollectionTime = 18e+6, //This is about 5 hours
	maxCacheLife = 7.2e+6, //This is about 2 hrs in milliseconds
	cache = {},
	tempBlacklist = [],
	tempBlacklistLife = 3.6e+6, //This is about 1 hr in milliseconds
	maxTempBlacklistLife = 8.64e+7, //This is about 1 day in milliseconds
	maxStrikeCount = 10, //The max number of strikes before a temp blacklisting
	strikes = {}, //Where we keep a tally of minor infractions
	blacklist = [], //Hard bans
	charsetOverrides = {
		'application/javascript': '; charset=utf-8',
		'text/css': '; charset=utf-8',
		'text/html': '; charset=utf-8',
		'text/plain': '; charset=utf-8',
		'application/json': '; charset=utf-8'
	},

	//Handles the strike counter
	addStrike = (meta) => {

		//Fetch/create a strike counter
		strikes[meta.fetchUrl] = strikes[meta.fetchUrl] || {count: 0, timestamp: new Date().getTime()}
		
		//Add a strike
		strikes[meta.fetchUrl].count++

		//Too many strikes too quickly? Add them to the tempBlacklist
		if (strikes[meta.fetchUrl].count > maxStrikeCount && (new Date().getTime() - strikes[meta.fetchUrl].timestamp) < tempBlacklistLife && !meta.blacklisted) {
			tempBlacklist.push(meta.fetchUrl)
		}
		
		
	},

	//Check for expired strikes & temp blacklistings
	clearExpiredStrikes = () => {
		for (let i in tempBlacklist) {
			
			//Have they had less than the maxStrikeCount in the tempBlacklistLife OR In total is the age og the temp blacklisting over maxTempBlacklistLife
			if (strikes[tempBlacklist[i]].count < maxStrikeCount && (new Date().getTime() - strikes[tempBlacklist[i]].timestamp) > tempBlacklistLife || (new Date().getTime() - strikes[tempBlacklist[i]].timestamp) > maxTempBlacklistLife) {
				
				//Ok remove them from the temp list
				delete tempBlacklist[i]
			}
		}
	},
	
	//Check for expired caches
	clearExpiredCaches = () => {
		let time = new Date().getTime()
		//Go through all the the currently cached items 
		for (let i in cache) {

			//Is the cache older than maxCacheLife?
			if (time - cache[i].timestamp > maxCacheLife) {
				
				//It is? Delete it then
				delete cache[i]
			}
		}
	},
	
	//Save strikes to disk
	saveStrikes = () => {
		fs.writeFile(__dirname + '/strikes.json', JSON.stringify(strikes), (err) => {
			if (err) console.log(err)
		})
	},
	
	//Save cache to disk 
	saveCaches = () => {
		fs.writeFile(__dirname + '/caches.json', JSON.stringify(cache), (err) => {
			if (err) console.log(err)
		})
		
	},
	
	//Force a garbage collection event.
	runGarbageCollection = () => {
		if (global && global.gc) global.gc()
	},	
	
	//This handles all the occasional tasks, like cache clearing, strike management, garbage collection, etc
	periodicChecks = () => {
	
		//Clear the expires stuff 
		clearExpiredStrikes()
		clearExpiredCaches()
		
		//Save what remains, in-case the server restarts. 
		saveStrikes()
		saveCaches()
	},
	
	//create the return url
	createRedirectUrl = (req, headers, meta, sha)  => {
		let scheme,
			host = headers.host || cdnURL
		if (headers['cf-visitor'] && headers['cf-visitor'].scheme) {
			scheme = headers['cf-visitor'].scheme
		}
		else {
			scheme = 'https'
		}
		return `${scheme}://${host}/cdn/${meta.owner}/${meta.repo}${(meta.gist ? '/raw' : '')}/${sha}/${meta.filePath}${meta.querystring.length > 0 ? '?' + meta.querystring : ''}`
	},

	//Serves the favicon accounting for it being pre gzipped
	faviconFunc = (req, res)  => {
		res.setHeader('Content-Encoding', 'gzip')
		res.setHeader('Content-Type', 'image/x-icon')
		res.send(favicon)
	},
	
	//Unify the error response system
	sendError = (res, meta, status) => {
		//Strip the cache properties... just in case
		res.setHeader('Content-Type', 'text/plain; charset=utf-8')
		res.setHeader("Cache-Control", "public, max-age=0");
		res.setHeader("Expires", new Date(Date.now() - 2592000000).toUTCString());
		
		console.log('Error code:', status, 'File: ', `${meta.owner}/${meta.repo}/${meta.branch}/${meta.filePath}`)
		addStrike(meta)
		
		//Send the status code
		res.sendStatus(status)
	},
	
	//Fetch all the metadata for the requested url
	getMeta = (oUrl) => {
	
		let meta = {},
			blacktlistTests = []
		
		//The base split
		meta.t = oUrl
		
		//Filter out the initial url prepension
		if (meta.t.substr(0, 5) == '/cdn/') {
			meta.cdnType = meta.t.substr(1, 3)
			meta.t = meta.t.substr(5)
		}
		else if (meta.t.substr(0, 6) == '/repo/') {
			meta.cdnType = meta.t.substr(1, 4)
			meta.t = meta.t.substr(6)
		}
		
		//The raw url
		meta.raw = meta.t.split('/')
		
		//The repo owner
		meta.owner = meta.raw.shift()
		
		//The repo to look at
		meta.repo = meta.raw.shift()
		
		
		//Is this a gist?
		meta.gist = meta.raw[0] === 'raw'
		
		//If it IS a gist add the raw field
		if (meta.gist) meta.raw.shift()
		
		//Add the branch field
		meta.branch = String(meta.raw.shift())
		
		//Is this an sha, or a branch?
		//Does this by checking first length, then if its hex compatible
		//Super naive, hopefully no one is using branch names that are only 0-9, a-f, and lowercase 40 characters long ...		
		meta.isHash = meta.branch.length === 40 && (meta.branch.match("[0-9a-f]+") || []).length === 1
		
		//The cache ID for this repo
		meta.cacheID = `${meta.owner}/${meta.repo}/${meta.branch}`
				
		//Add the file we're asking for, and remove the querystring
		meta.filePath = meta.raw.join('/').split('?')[0]
	
		//Add the querystring, if any 
		meta.querystring = meta.raw.join('/').split('?')[1] || '' 
		meta.fetchUrl = (meta.gist ? gistURL : rawURL) + '/' + meta.owner + '/' + meta.repo + (meta.gist ? '/raw' : '') + '/' +  meta.branch + '/' + meta.filePath
		
		//Defaults to no blacklisted
		meta.blacklisted = false 
			
		//Check if this owner/repo/branch/gist/file is permanently blacklisted
		
		meta.blacklisted = 
			blacklist.indexOf(meta.raw.join('/')) > -1 ||
			blacklist.indexOf(meta.repo) > -1 || 
			blacklist.indexOf(meta.owner) > -1 || 
			blacklist.indexOf(meta.branch) > -1 || 
			blacklist.indexOf(meta.fetchUrl) > -1
			
		//Check if this file is temporarily blacklisted (only if not permanently blacklisted)
		if (!meta.blacklisted) {
			meta.blacklisted = tempBlacklist.indexOf(meta.fetchUrl) > -1
		}
		
		return meta
	}, 

	//Serves the repo route
	repoFunc = (req, res)  => {
	
		let meta = getMeta(req.originalUrl), /*Define the meta data*/
			cached = cache[meta.cacheID]
		
		//Are they blacklisted? Cut them off
		if (meta.blacklisted) {
			res.status(403).send("Forbidden - This repo/gist is on the blacklist. If you wish to appeal, please open an issue here: https://github.com/schme16/gitcdn.xyz/issues, with why you feel this repo should not be on the blacklist.")
			return false
		}
		
		//Not blacklisted? But missing info? Send a 404, add a strike
		else if ((!meta.repo && !meta.owner) && !meta.gist) {
			res.sendStatus(404)
			return false
		}
		else {

			/*If the repo is cached, just send that back, and update it for next time*/
			if (!!cached) {
				lastCall(meta, cached.sha || cached.branch, req, res)
			}
			
			//Ok, either the cache is older than the max cache life, or no cache was found. Lets fetch it!
			else {
				if (meta.gist) {
					lastCall(meta, meta.branch, req, res)
				}
				else if (meta.filePath) {
					if (!meta.isHash) {
						git.listRemote([`https://github.com/${meta.owner}/${meta.repo}`, 'HEAD'], (err, response) => {
							if (err) {
								sendError(res, meta, 404)
							}
							else {
								let sha = response.split(`\t`)[0]
								cache[meta.cacheID] = {
									sha: sha,
									timestamp: new Date().getTime()
								}
								lastCall(meta, sha, req, res)
							}
						})
					}
					else {
						lastCall(meta, meta.branch, req, res)
					}
				}
				else {
					sendError(res, meta, 412)
				}
			}
		}
	},

	//Serves the cdn route
	cdnFunc = (req, res)  => {
		//Gets the meta
		let meta = getMeta(req.originalUrl) /*Define the meta data*/
		
		if (meta.blacklisted) {
			res.status(403).send("Forbidden - This repo/gist is on the blacklist. If you wish to appeal, please open an issue here: https://github.com/schme16/gitcdn.xyz/issues, with why you feel this repo should not be on the blacklist.")
			return false
		}
		else if (meta.filePath) {
			//TODO: re-write the data fetch request
			req.pipe(http.request(meta.fetchUrl, (newRes)  => {
				if (newRes.statusCode === 200) {
					let mimeType = mime.lookup(meta.filePath)
					res.setHeader('Content-Type', mimeType + (charsetOverrides[mimeType] || ''))
					res.setHeader("Cache-Control", "public, max-age=2592000");
					res.setHeader("Expires", new Date(Date.now() + 2592000000).toUTCString());
					newRes.pipe(res)
				}
				else {
					sendError(res, meta, newRes.statusCode)
				}
	
			}).on('error', (err) => {
				
				//Give them a strike
				addStrike(meta)
				
				sendError(res, meta, 500)
				
				//Log that this client got a strike
				console.log(new Error('Status 500: couldn\'t pipe file to client: ' + meta.fetchUrl))
			}))
		}
		else {
			sendError(res, meta, 412)
		}
	},

	//Handles redirection
	lastCall = (meta, sha, req, res)  => {
		if (sha) {
			let newUrl = createRedirectUrl(req, req.headers, meta, sha)
			res.redirect(301, newUrl)
		}
		else {
			sendError(res, meta, 404)
		}
	}


//Set some global route settings
app.set('etag', 'strong') // use strong etags
app.use(cors())


//Set up the express routes
app.use('/favicon.ico', faviconFunc)//Serve the site icon
app.use('/', staticContent)
app.get('/cdn/*', cdnFunc)
app.use('/repo/*', repoFunc)



//Load the blacklist cache file, if it exists
fs.readFile(__dirname + '/blacklist.json', (err, data) => {
	if (!err) {
		try {
			blacklist = JSON.parse(data)
		}
		catch(e) {
			blacklist = []
		}
	}
	else {
		blacklist = []
		fs.writeFile(__dirname + '/blacklist.json', JSON.stringify(blacklist), () => {
			console.log('Created a blacklist file')
		})
	}

	//Now load the strikes
	fs.readFile(__dirname + '/strikes.json', (err, data) => {
		if (!err) {
			try {
				strikes = JSON.parse(data)
			}
			catch(e) {
				strikes = []
			}
		}
		else {
			strikes = []
		}
		
		//Finally, load the caches
		fs.readFile(__dirname + '/caches.json', (err, data) => {
			if (!err) {
				try {
					cache = JSON.parse(data)
				}
				catch(e) {
					cache = []
				}
			}
			else {
				cache = []
			}
			
			//Start the periodic checks and GC
			setInterval(periodicChecks, 10000)
			setInterval(runGarbageCollection, garbageCollectionTime)

			//Launch the app
			console.log(`App started on port: ${port}`)
			app.listen(port)
		})
	})
})


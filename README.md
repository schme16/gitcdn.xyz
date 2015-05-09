# GitCDN
A CDN for raw.githubusercontent.com content, that always links to the latest version (aka your master branch)

##Build Status
[![wercker status](https://app.wercker.com/status/3bd39472bd17b07fe55170316d6a8fbf/m "wercker status")](https://app.wercker.com/project/bykey/3bd39472bd17b07fe55170316d6a8fbf)

##How to use
1. Get the https://raw.githubusercontent.com address for the file you're looking for, it is in the following format: `https://raw.githubusercontent.com/USER/PROJECT/COMMIT/FILE`
**Example:** `https://raw.githubusercontent.com/schme16/gitcdn.xyz/master/README.md`

2. **[Get latest commit]** Replace `https://raw.githubusercontent.com/` with `https://gitcdn.xyz/repo/` and switch the commit from /master/ to your designed commit sha1 **Example:** `https://gitcdn.xyz/repo/schme16/gitcdn.xyz/master/README.md`
**[Get specific commit]** Replace `https://raw.githubusercontent.com/` with `https://gitcdn.xyz/cdn/` **Example:** `https://gitcdn.xyz/cdn/schme16/gitcdn.xyz/b5ccbec532d3cfe7eb9dec60b95317654a1be09f/README.md`

##How much does GitCDN cost?
GitCDN is TOTALLY FREE! 
That's not to say I won't have plans that have a monthly/yearly price in the future, but the repo CDN service will ALWAYS be free, without the need for signup!


##Want to buy me a coffee?
This service is totally free, but is made possible with donations from awesome people like you!
If you'd like to show your thanks, please consider making a [donation](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=XHCYVRJHZ9XYN)!

[![Donate via Paypal](https://www.paypalobjects.com/en_AU/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=XHCYVRJHZ9XYN)


##So how does GitCDN work?
GitCDN works by creating a short-cached (~2 hours cache time) lookup of the latest commit of the specified file, then redirecting you to a long-cached (~1 week cache time on edge servers, and ~1 year cache time on primary servers) version of that file.

##Do I always have to use the latest commit?
Nope!
See point #2 in the [How to use](#how-to-use) section above. But basically you just use /cdn/ instead of /repo/ and use a commit hash instead of `master`.


##Can I manually flush the cache?
No.
Whilest theoretically an API could be added to allow you to request a cache flush of your item, the current implimentation of cacheing via a redirect page that only caches for ~2 hours makes the nessecity of this lower, but the server load exponentially higher. Feel free to still add submit it as a feature request/pull request


##How is this Different from [RawGit.com](https://rawgit.com)
The main difference is our focus on providing the **latest** commit of a given GitHub file, where as RawGit has more of a focus on providing **specific commits**.

Another major difference between GitCDN and RawGit, is what CDN providers I use:
 - GitCDN uses [Cloudflare](https://cloudflare.com).
 - RawGit uses [MaxCDN](https://maxcdn.com).

Lastly, GitCDN and RawGit have a slightly different setup for development and cdn versions.
RawGit provides a live version of your file (`https://rawgit.com/`) that updates in real-time (whis is only useful when using your master branch) and a CDN version (`//cdn.rawgit.com`); GitCDN on the other hand, caches every request made to `https://gitcdn.xyz/repo/` for a breif period (~2 hours), this means that any change made can take up to 2 hours to propagate through to all users, but means you don't have to worry about leaving a dev link in your production environment and accidentally overwhelming our service, see: https://rawgit.com/faq#rawgit-com-in-production for why I chose this route.


It should be noted that Cloudflare, strickly speaking, is not a CDN, and that its original focus was on network security/attack mitigation, the side effect of this is that they cache files much like a traditional CDN.

**Sidenote:** I've been using Cloudflare for a several years and have been more than happy with their service, but for a broader opinion you can see a pretty good write-up by [Kevin Muldoon](http://www.kevinmuldoon.com/), [Cloudflare vs MaxCDN](http://winningwp.com/cloudflare-vs-maxcdn/), which covers each oif their strengths pretty nicely, and for more details about RawGit please see their [FAQ](https://rawgit.com/faq)


##Does this mean I can host a website straight from GitHub?
Almost, you can certainly host all of your files here, then link them in the index of your website!


##Plans for the future
 - Better (Re: any) website frontpage; I love how easy RawGit made their url helper, so I will be including something similar ASAP!
 - My goal is to add the ability to host your static website directly from your GitHub repo, with CNAME support for custom domains. There's no timeline for completion, but I'm super keen to make it happen (For free, of course).
 - There are also still plenty of optimizations to do; but this service is definitly ready for production.


##Have an issue, idea or feedback?
Great! We love hearing from you, just visit [https://github.com/schme16/gitcdn.xyz/issues/new](https://github.com/schme16/gitcdn.xyz/issues/new) and submit your great idea/annoying bug/awesome feedback!


##Acknowledgements & Background
The inspiration for this whole project comes from [RawGit](https://rawgit.com/) from [Ryan Grove](http://wonko.com/)
I absolutly love the service that Ryan has made available, and have used it for quite a while with great results! However the more I used it, the more I realised I needed to be able to get the latest version of a file, without having to change all of my links in README's and HTML pages, and so GitCDN was born!

As this service is free, I make no guarantees about Up-time nor do I have anything resembling an SLA.
If you're a company/service that needs that guarantee on your uptime (like an SLA), please consider using Cloudflare/MaxCDN directly.

Please note that GitCDN is not affiliated with GitHub or RawGit, Cloudflare or MaxCDN, and as such any feedback/issues/etc. should be filed with the respective party.
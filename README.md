# WebDB <sup><sub>v0.2.0</sub></sup>
**If the client can't get to the database, we bring the database to the client.**

Traditional web apps get everything they show from the server and send any user input to the server. 
As the user browses through the site, the same data is fetched over and over. And if the user
goes offline, the app stops functioning.

What if we could download the server database to the client and perform queries against it there?

## Smart subset
I know what you are thinking. There is way too much data to download the entire database right?

But think about this some more. Facebook has hundreds of milions of active users, who collectively 
post billions of status updates, photos, videos and chat messages each day. But most of that data
is irrelevant to any single user. For most users, only those people they are friends with and the 
posts made by those friends, are relevant.

What if we could define a subset of our total server data, based on characteristics of the user
(such as who their friends are) and actively keep a local copy of that subset synched right there 
on the user's machine? We would be able to offer offline functionality. We would potentially get
*extremely* fast response times due to no network latency. Life would be better.

This is what WebDB tries to accomplish. It allows you to define a database schema on the client 
side (corresponding to the subset of data that is relevant to this client) and keep it synched
with the server automagically.

It consists of a client-side component (that you are looking at right now) and a server side 
component. The server-side component is written in Java but doesn't have to be. 

## Under construction
WebDB is currently under heavy development and not ready for production just yet. 
Use at your own risk!

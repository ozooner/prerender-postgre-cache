# prerender-postgre-cache

PostgreSQL storage for prerendered HTML. 
Automatically creates a table 'pages' and stores the processed HTML as gzipped bytea.

## Why is it different from other caches?

 1. Good old relational database.
 2. uses GZIP compression to save storage (it matters if you have 50k pages) .
 3. in addition to stripping javascript, it also removes inline fonts, inline audio and replaces inline byte64 encoded images with 1px transparent ones.
 4. stripping happens once before html is stored (as opposed to always
    stripping before returning to client).
    
    

## Installation:

    npm install prerender-postgre-cache

Edit server.js:

    //server.use(prerender.removeScriptTags()); 
    //Script tags are removed pre-storage, no need to run it
    process.env.POSTGRES_URI = "postgres://<user>:password>@<host>/<db>";
    server.use(require('prerender-postgre-cache'));
    server.start();
    

------------------
<br/>
<a href="http:fadeit.dk"><img src="http://fadeit.dk/src/assets/img/brand/fadeit_logo_full.svg" alt="The fadeit logo" style="width:200px;"/></a><br/><br/>

#### About fadeit
We build awesome software, web and mobile applications.
See more at [fadeit.dk](http://fadeit.dk)



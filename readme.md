# Plex Web

This repository contains (most of) the source code for plex.danrahn.com. It it first and foremost a coding playground that purposefully does not utilize any JS libraries or frameworks, other than NPM libraries for minification, outlined below.

Some things to note:

1. Within the root, the following extra structure is expected (and created via build.py):

        includes\
            cache\
                background\  // Blurred backgrounds for active streams
                    art\     // Actual artwork
                    thumb\   // Fallback if no artwork found
                poster\      // Cache of external (non-plex) posters used for requests
                    342\     // Larger posters
                thumb\       // Thumbnails for active streams - grabbed from Plex
        min\                 // Minified sources
            icon\
            script\
            style\
2. There are some additional requirements that are not included in this repository:
    * [PHPMailer](https://github.com/PHPMailer/PHPMailer) - For email/text alerts. I'd love to remove this dependency, since having this project be completely self-contained would be nice
    * [npm](https://www.npmjs.com/) - Several packages are used for source minification:
        * [terser](https://openbase.io/js/terser) - For javascript minification
            * Optionally, [babel](https://www.npmjs.com/package/Babel), if `-babel` is supplied as an argument to build.py
        * [CSSO](https://github.com/css/csso) - For CSS minification
            * Optionally, [clean-css](https://www.npmjs.com/package/clean-css) if supplied as an argument to build.py (via [clean-css-cli](https://github.com/jakubpawlowicz/clean-css-cli))
        * [SVGO](https://github.com/svg/svgo) - For SVG minification

## Deploying
1. Install prerequisites
    * Install MySQL, Apache, and PHP (potentially via [WampsSrver](https://www.wampserver.com/en/)).
    * Install [Node.js](https://nodejs.org/en/) and `npm install -g` the requisite modules outlined above (at a minimum, terser, CSSO, and SVGO).
    * Copy the contents of [PHPMailer](https://github.com/PHPMailer/PHPMailer)'s `src` folder to `includes\phpMail\`
2. In MySQL, create the tables outlined in includes\tables.sql
4. Run `includes\build.py` from the directory root. On Windows, run `py -3 includes\build.py -?` for more instructions.
5. Copy includes\config_dummy.php to includes\config.php, and fill in the correct values
6. httpd.conf - users need access to the files in the root directory, `min`, and `res`. `includes` should only be accessible locally.
7. SSL - this source expects SSL to be enabled (e.g. via httpd-ssl.conf and [LetsEncrypt](https://letsencrypt.org/)). If you don't use SSL, you will have to comment out the implementation of `requireSSL` in `includes\common.php` and replace any https links that reference the site with http.

## TODOs
Some random ideas:
1. Bake MySQL table creation/updating into build.py
2. Better administration page to allow more server management capabilities
3. Improve stats dropdown - LI contents aren't very polished

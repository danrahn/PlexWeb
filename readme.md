# Plex Web

This repository contains (most of) the source code for danrahn.com/plex. Some things to note:

1. This is running using Wamp64 - Apache+PHP+MySQL
2. Within the `includes/` folder, the following structure is required:

        includes\
            cache\
                background\
                    art\
                    poster\
                    thumb\
                thumb\
3. There are some additional requirements that are not included in this repository:
  * [PHPMailer](https://github.com/PHPMailer/PHPMailer) - For email/text alerts. I'd love to remove this dependency, since having this project be completely self-contained would be nice (for my own learning, not just to reinventing the wheel)
  * fontawesome-webfont may or may not be necessary. It's currently used for play/pause icons in active streams

## TODOs

Some random ideas:
1. Better CSS management - don't shove everything into `style.css`, and avoid inlining when it makes sense
2. General cleanup - consistent style/comments. Shorten some functions in `script.js`
3. Detect subtitle usage and report in active streams
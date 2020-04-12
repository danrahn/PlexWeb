# Plex Web

This repository contains (most of) the source code for danrahn.com/plex. Some things to note:

1. Run in WampServer (Apache + PHP + MySQL)

2. Within the `includes/` folder, the following structure is required:

        includes\
            cache\
                background\
                    art\
                    poster\
                    thumb\
                thumb\
3. There are some additional requirements that are not included in this repository:
  * [PHPMailer](https://github.com/PHPMailer/PHPMailer) - For email/text alerts. I'd love to remove this dependency, since having this project be completely self-contained would be nice
  * [terser](https://openbase.io/js/terser) - For javascript minification

## TODOs

Some random ideas:
1. Detect subtitle usage and report in active streams
2. Better administration page to allow more server management capabilities
# Plex Web

This repository contains (most of) the source code for danrahn.com/plexweb. Some things to note:

1. This is running using Wamp64 - Apache+PHP+MySQL
2. Within the `includes/` folder, the following structure is required:

        includes\
            cache\
                background\
                    art\
                    thumb\
                thumb\
3. There are some additional requirements that are not included in this repository:
  * [adrenth/thetvdb2](https://github.com/adrenth/thetvdb2) - I'm hoping to remove this dependency, it brings in way too much for what I'm using it for
  * [PHPMailer](https://github.com/PHPMailer/PHPMailer) - For email/text alerts
  * fontawesome-webfont may or may not be necessary. It's used for play/pause icons in active streams
4. The following SQL tables are required:

	```SQL
	CREATE TABLE `users` (
		`id` int(11) NOT NULL AUTO_INCREMENT,
		`username` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
		`username_normalized` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
		`password` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
		`level` int(11) NOT NULL DEFAULT '0',
		`last_login` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
		`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (`id`),
		UNIQUE KEY `username` (`username`),
		KEY `username_normalized` (`username_normalized`)
	) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci


	CREATE TABLE `user_info` (
	 `id` int(11) NOT NULL AUTO_INCREMENT,
	 `userid` int(11) NOT NULL,
	 `firstname` varchar(128) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
	 `lastname` varchar(128) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
	 `email` varchar(256) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
	 `email_alerts` tinyint(1) NOT NULL DEFAULT '0',
	 `phone` bigint(12) NOT NULL DEFAULT '0',
	 `phone_alerts` tinyint(1) NOT NULL DEFAULT '0',
	 `carrier` varchar(32) COLLATE utf8_unicode_ci NOT NULL DEFAULT 'verizon',
	 PRIMARY KEY (`id`),
	 UNIQUE KEY `userid` (`userid`),
	 CONSTRAINT `user_info_ibfk_1` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
	) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci


	CREATE TABLE `user_requests` (
	 `id` int(11) NOT NULL AUTO_INCREMENT,
	 `username_id` int(11) NOT NULL,
	 `request_type` int(11) NOT NULL COMMENT 'Permission or Media request',
	 `request_name` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
	 `comment` varchar(1024) COLLATE utf8_unicode_ci NOT NULL,
	 `satisfied` smallint(1) NOT NULL DEFAULT '0' COMMENT '0=Pending;1=Approved;2=Denied',
	 `request_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	 `satisfied_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	 `admin_comment` varchar(1024) COLLATE utf8_unicode_ci DEFAULT NULL,
	 PRIMARY KEY (`id`),
	 KEY `username_id` (`username_id`),
	 CONSTRAINT `user_requests_ibfk_1` FOREIGN KEY (`username_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
	) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci


	CREATE TABLE `logins` (
	 `id` int(11) NOT NULL AUTO_INCREMENT,
	 `userid` int(11) NOT NULL,
	 `ip` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
	 `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	 PRIMARY KEY (`id`)
	) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci


	CREATE TABLE `imdb_tv_cache` (
	 `entry` int(11) NOT NULL AUTO_INCREMENT,
	 `show_id` int(11) NOT NULL,
	 `season` int(11) NOT NULL,
	 `episode` int(11) NOT NULL,
	 `imdb_link` varchar(32) COLLATE utf8_unicode_ci NOT NULL,
	 `date_added` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	 PRIMARY KEY (`entry`)
	) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci


	CREATE DEFINER=`root`@`localhost` TRIGGER `create_user_info` AFTER INSERT ON `users` FOR EACH ROW INSERT INTO user_info (userid, firstname, lastname, email, email_alerts, phone, phone_alerts, carrier)
	   VALUES (NEW.id, '', '', '', 0, 0, 0, 'verizon')
	```

## TODOs

Some random ideas:
1. Better file naming (`script.js`, really?)
2. Better CSS management - don't shove everything into `style.css`, and avoid inlining when it makes sense
3. General cleanup - consistent style/comments. Shorten some functions in `script.js`
4. A lot of potential functionality - make the request system better/more interactive. Allow comment threads instead of a single admin/user comment
5. Web notifications - alert the user when they log in if changes have been made since their last visit
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
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `user_requests` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `username_id` int(11) NOT NULL,
 `request_type` int(11) NOT NULL COMMENT 'Permission or Media request',
 `request_name` varchar(128) COLLATE utf8_unicode_ci NOT NULL,
 `comment` varchar(1024) COLLATE utf8_unicode_ci NOT NULL,
 `satisfied` smallint(1) NOT NULL DEFAULT '0' COMMENT '0=Pending;1=Approved;2=Denied;3=In Progress;4=Waiting',
 `request_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `satisfied_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 `admin_comment` varchar(1024) COLLATE utf8_unicode_ci DEFAULT NULL,
 `external_id` int(11) DEFAULT NULL,
 `poster_path` varchar(48) COLLATE utf8_unicode_ci NOT NULL,
 `comment_count` int(11) NOT NULL DEFAULT '0',
 PRIMARY KEY (`id`),
 KEY `username_id` (`username_id`),
 CONSTRAINT `user_requests_ibfk_1` FOREIGN KEY (`username_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=143 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

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
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `request_comments` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `req_id` int(11) NOT NULL,
 `user_id` int(11) NOT NULL,
 `content` text COLLATE utf8_unicode_ci NOT NULL,
 `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `req_id` (`req_id`),
 CONSTRAINT `request_comments_ibfk_1` FOREIGN KEY (`req_id`) REFERENCES `user_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `ip_cache` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `ip` varchar(45) COLLATE utf8_unicode_ci NOT NULL,
 `city` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
 `state` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
 `country` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
 `isp` varchar(128) COLLATE utf8_unicode_ci NOT NULL,
 `query_count` int(11) NOT NULL DEFAULT '1',
 `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `imdb_tv_cache` (
 `entry` int(11) NOT NULL AUTO_INCREMENT,
 `show_id` int(11) NOT NULL,
 `season` int(11) NOT NULL,
 `episode` int(11) NOT NULL,
 `imdb_link` varchar(32) COLLATE utf8_unicode_ci NOT NULL,
 `date_added` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`entry`)
) ENGINE=InnoDB AUTO_INCREMENT=1730 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `logins` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `userid` int(11) NOT NULL,
 `invalid_username` varchar(50) COLLATE utf8_unicode_ci DEFAULT NULL,
 `ip` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
 `user_agent` varchar(256) COLLATE utf8_unicode_ci NOT NULL,
 `status` enum('Success','IncorrectPassword','BadUsername','ServerError') COLLATE utf8_unicode_ci NOT NULL,
 `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=1155 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `background_color_cache` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `path` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
 `red` int(3) NOT NULL,
 `green` int(3) NOT NULL,
 `blue` int(3) NOT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `path` (`path`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

# Triggers
CREATE TRIGGER `UpdateCommentCount` AFTER INSERT ON `request_comments`
 FOR EACH ROW UPDATE user_requests r SET r.comment_count=r.comment_count+1 WHERE r.id=NEW.req_id

 CREATE TRIGGER `create_user_info` AFTER INSERT ON `users`
 FOR EACH ROW INSERT INTO user_info (userid, firstname, lastname, email, email_alerts, phone, phone_alerts, carrier)
    VALUES (NEW.id, '', '', '', 0, 0, 0, 'verizon')
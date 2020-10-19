/*
 * Table definitions for the backing database.
 * Generated via 'show create table XYZ'
 */

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

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
 `external_id` varchar(32) COLLATE utf8_unicode_ci DEFAULT NULL,
 `internal_id` int(11) DEFAULT NULL,
 `poster_path` varchar(256) COLLATE utf8_unicode_ci DEFAULT NULL,
 `comment_count` int(11) NOT NULL DEFAULT '0',
 PRIMARY KEY (`id`),
 KEY `username_id` (`username_id`),
 CONSTRAINT `user_requests_ibfk_1` FOREIGN KEY (`username_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

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
 `alert_prompt` tinyint(1) NOT NULL DEFAULT '1',
 PRIMARY KEY (`id`),
 UNIQUE KEY `userid` (`userid`),
 CONSTRAINT `user_info_ibfk_1` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_c

CREATE TABLE `request_comments` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `req_id` int(11) NOT NULL,
 `user_id` int(11) NOT NULL,
 `content` text COLLATE utf8_unicode_ci NOT NULL,
 `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `last_edit` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `req_id` (`req_id`),
 CONSTRAINT `request_comments_ibfk_1` FOREIGN KEY (`req_id`) REFERENCES `user_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `imdb_tv_cache` (
 `entry` int(11) NOT NULL AUTO_INCREMENT,
 `show_id` int(11) NOT NULL,
 `season` int(11) NOT NULL,
 `episode` int(11) NOT NULL,
 `imdb_link` varchar(32) COLLATE utf8_unicode_ci NOT NULL,
 `date_added` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`entry`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `tmdb_cache` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `tmdb_id` int(11) NOT NULL,
 `imdb_id` varchar(32) COLLATE utf8_unicode_ci NOT NULL,
 `date_added` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `logins` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `userid` int(11) NOT NULL,
 `invalid_username` varchar(50) COLLATE utf8_unicode_ci DEFAULT NULL,
 `ip` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
 `user_agent` varchar(256) COLLATE utf8_unicode_ci NOT NULL,
 `status` enum('Success','IncorrectPassword','BadUsername','ServerError') COLLATE utf8_unicode_ci NOT NULL,
 `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `background_color_cache` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `path` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
 `red` int(3) NOT NULL,
 `green` int(3) NOT NULL,
 `blue` int(3) NOT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `path` (`path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `activities` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `type` int(11) NOT NULL COMMENT 'activity type defined in activity_names table',
 `user_id` int(11) NOT NULL COMMENT 'the user affected by the activity',
 `admin_id` int(11) NOT NULL DEFAULT '0' COMMENT '0 if user-initiated',
 `request_id` int(11) NOT NULL COMMENT 'The id of the associated request',
 `data` json NOT NULL COMMENT 'Additional activity properties',
 `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'The time this activity occurred',
 PRIMARY KEY (`id`),
 KEY `update_admin_actions` (`admin_id`),
 KEY `update_user_actions` (`user_id`),
 KEY `update_request_actions` (`request_id`),
 CONSTRAINT `update_request_actions` FOREIGN KEY (`request_id`) REFERENCES `user_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `update_user_actions` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `activity_status` (
 `user_id` int(11) NOT NULL,
 `last_viewed` timestamp NOT NULL,
 UNIQUE KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `js_errors` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `error` text COLLATE utf8_unicode_ci NOT NULL,
 `stack` text COLLATE utf8_unicode_ci NOT NULL,
 `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `password_reset` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `user_id` int(11) NOT NULL,
 `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `token` char(64) COLLATE utf8_unicode_ci NOT NULL,
 `used` tinyint(1) NOT NULL DEFAULT '0',
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `library_stats_cache` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `data` json NOT NULL,
 `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `imdb_ratings` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `imdbid` int(11) NOT NULL,
 `rating` int(11) NOT NULL,
 `votes` int(11) NOT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `imdbid` (`imdbid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

CREATE TABLE `banned_ips` (
 `id` int(11) NOT NULL AUTO_INCREMENT,
 `ip` varchar(39) COLLATE utf8_unicode_ci NOT NULL,
 `why` varchar(256) COLLATE utf8_unicode_ci NOT NULL,
 `date_added` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci

# Triggers
CREATE TRIGGER `IncrementCommentCount` AFTER INSERT ON `request_comments`
 FOR EACH ROW UPDATE user_requests r SET r.comment_count=r.comment_count+1 WHERE r.id=NEW.req_id

CREATE TRIGGER `DecrementCommentCount` AFTER INSERT ON `request_comments`
 FOR EACH ROW UPDATE user_requests r SET r.comment_count=r.comment_count-1 WHERE r.id=NEW.req_id

 CREATE TRIGGER `DeleteActivities` BEFORE DELETE ON `request_comments`
 FOR EACH ROW DELETE FROM activities WHERE type=2 AND JSON_EXTRACT(data, "$.comment_id")=OLD.id

 CREATE TRIGGER `create_user_info` AFTER INSERT ON `users`
 FOR EACH ROW INSERT INTO user_info (userid, firstname, lastname, email, email_alerts, phone, phone_alerts, carrier)
    VALUES (NEW.id, '', '', '', 0, 0, 0, 'verizon')

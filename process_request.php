<?php
/// <summary>
/// The main class for processing requests. Monolithic, but IMO better than a bunch of different php files
/// 
/// The only required field is 'type', everything else is dependant on the specified type
///
/// The expected pattern for methods is to have them return a JSON string on success or failure.
/// If a GET/POST parameter is set incorrectly, it's very likely that the method will not return
/// and the process will `exit` immediately.
/// </summary>

require_once "includes/common.php";
require_once "includes/config.php";
require_once "includes/tvdb.php";

try {

$type = (int)get('type');

/// <summary>
/// Enum of all possible request types
/// </summary>
abstract class ProcessRequest
{
    const Login = 1;
    const Register = 2;
    const UpdatePassword = 3;
    const ResetPassword = 4;
    const RequestPasswordReset = 5;
    const PasswordResetAdmin = 6;
    const CheckUsername = 7;
    const NewRequest = 8;
    const GetRequests = 9;
    const NextRequest = 10;
    const PermissionRequest = 11;
    const SetUserInfo = 12;
    const GetUserInfo = 13;
    const GetMembers = 14;
    const GetAllMembers = 15;
    const SearchPlex = 16;
    const SearchExternal = 17;
    const SetExternalId = 18;
    const GetSeasonDetails = 19;
    const GeoIP = 20;
    const AddComment = 21;
    const DeleteComment = 22;
    const EditComment = 23;
    const GetComments = 24;
    const GetActivities = 25;
    const NewActivities = 26;
    const LogError = 27;
    const UpdatePoster = 28;
    const CheckNotificationAlert = 29;
    const DisableNotificationAlert = 30;
    const MarkdownText = 31;
    const FreeSpace = 32;
    const LibraryStats = 33;
    const SetInternalId = 34;
    const GetInternalId = 35;
    const ImdbRating = 36;
    const UpdateImdbRatings = 37;
    const GetImdbUpdateStatus = 38;
}

// For requests that are only made when not logged in, don't session_start or verify login state
switch ($type)
{
    case ProcessRequest::CheckUsername:
    case ProcessRequest::Login:
    case ProcessRequest::Register:
    case ProcessRequest::RequestPasswordReset:
    case ProcessRequest::ResetPassword:
    case ProcessRequest::MarkdownText:
        break;
    default:
        session_start();
        verify_loggedin(FALSE /*redirect*/, "" /*return*/, TRUE /*json*/);
        break;
}

json_message_and_exit(process_request($type));

} catch (Throwable $e)
{
    if (UserLevel::is_admin())
    {
        $err = new \stdClass();
        $err->Error = $e;
        json_message_and_exit(json_encode($err));
    }
    else
    {
        json_error_and_exit("Sorry, something went wrong.");
    }
}

/// <summary>
/// Our main entrypoint. Returns a json message (on success or failure)
/// </summary>
function process_request($type)
{
    $message = "";
    switch ($type)
    {
        case ProcessRequest::Login:
            $message = login(get("username"), get("password"));
            break;
        case ProcessRequest::Register:
            $message = register(get("username"), get("password"), get("confirm"));
            break;
        case ProcessRequest::NewRequest:
            $message = process_suggestion_new(get("name"), get("mediatype"), get("external_id"), get("poster"));
            break;
        case ProcessRequest::PermissionRequest:
            $message = process_permission_request();
            break;
        case ProcessRequest::SetUserInfo:
            $message = update_user_settings(
                get('fn'),
                get('ln'),
                get('e'),
                get('ea'),
                get('p'),
                get('pa'),
                get('c'));
            break;
        case ProcessRequest::GetUserInfo:
            $message = get_user_settings();
            break;
        case ProcessRequest::CheckUsername:
            $message = check_username(get("username"));
            break;
        case ProcessRequest::GetMembers:
            $message = get_members((int)get("num"), (int)get("page"), get("search"), get("filter"));
            break;
        case ProcessRequest::GetAllMembers:
            $message = get_members_all();
            break;
        case ProcessRequest::SearchPlex:
            $message = search(get("query"), get("kind"));
            break;
        case ProcessRequest::GetSeasonDetails:
            $message = get_season_details(get("path"));
            break;
        case ProcessRequest::SearchExternal: // Unused? media_search.php
            $message = search_external(get("query"), get("kind"));
            break;
        case ProcessRequest::UpdatePassword:
            $message = update_password(get("old_pass"), get("new_pass"), get("conf_pass"));
            break;
        case ProcessRequest::GeoIP:
            $message = get_geo_ip(get("ip"));
            break;
        case ProcessRequest::SetExternalId:
            $message = set_external_id((int)get("req_id"), get("id"));
            break;
        case ProcessRequest::AddComment:
            $message = add_request_comment((int)get("req_id"), get("content"));
            break;
        case ProcessRequest::GetComments:
            $message = get_request_comments((int)get("req_id"));
            break;
        case ProcessRequest::NextRequest:
            $message = get_next_req((int)get("id"), (int)get("dir"));
            break;
        case ProcessRequest::GetRequests:
            $message = get_requests((int)get("num"), (int)get("page"), get("search"), get("filter"));
            break;
        case ProcessRequest::GetActivities:
            $message = get_activities((int)get("num"), (int)get("page"), get("search"), get("filter"));
            break;
        case ProcessRequest::NewActivities:
            $message = get_new_activity_count();
            break;
        case ProcessRequest::LogError:
            $message = log_error(get("error"), get("stack"));
            break;
        case ProcessRequest::RequestPasswordReset:
            $message = forgot_password(get("username"));
            break;
        case ProcessRequest::ResetPassword:
            $message = reset_password(get("token"), get("password"), get("confirm"));
            break;
        case ProcessRequest::PasswordResetAdmin:
            $message = forgot_password_admin(get("username"), get("email"));
            break;
        case ProcessRequest::DeleteComment:
            $message = delete_comment((int)get("comment_id"));
            break;
        case ProcessRequest::EditComment:
            $message = edit_comment((int)get("id"), get("content"));
            break;
        case ProcessRequest::UpdatePoster:
            $message = update_poster((int)get('rid'));
            break;
        case ProcessRequest::CheckNotificationAlert:
            $message = check_notification_alert();
            break;
        case ProcessRequest::DisableNotificationAlert:
            $message = disable_notification_alert();
            break;
        case ProcessRequest::MarkdownText:
            $message = get_markdown_text(try_get('mdType'));
            break;
        case ProcessRequest::FreeSpace:
            $message = get_available_space();
            break;
        case ProcessRequest::LibraryStats:
            $message = get_library_stats(try_get('force'));
            break;
        case ProcessRequest::SetInternalId:
            $message = set_internal_id((int)get("req_id"), (int)get("id"));
            break;
        case ProcessRequest::GetInternalId:
            $message = get_internal_id((int)get("req_id"));
            break;
        case ProcessRequest::ImdbRating:
            $message = get_imdb_rating(get("tt"));
            break;
        case ProcessRequest::UpdateImdbRatings:
            $message = force_update_imdb_ratings();
            break;
        case ProcessRequest::GetImdbUpdateStatus:
            $message = get_imdb_update_status();
            break;
        default:
            return json_error("Unknown request type: " . $type);
    }

    return $message;
}

/// <summary>
/// Enum of possible login attempt results
/// </summary>
class LoginResult
{
    const Success = 1;
    const IncorrectPassword = 2;
    const BadUsername = 3;
    const ServerError = 4;
}

/// <summary>
/// Attempts to login, returning an error on failure
/// </summary>
function login($username, $password)
{
    global $db;
    $username = trim($username);
    $ip = $db->real_escape_string($_SERVER['REMOTE_ADDR']);
    $user_agent = $db->real_escape_string($_SERVER['HTTP_USER_AGENT']);

    if (empty($username) || empty($password))
    {
        record_login($username, $ip, $user_agent, LoginResult::BadUsername);
        return json_error("Username/password cannot be empty!");
    }

    $username = trim($username);
    $normalized = strtolower($username);

    $normalized = $db->real_escape_string($normalized);
    $query = "SELECT id, username, username_normalized, password, level FROM users WHERE username_normalized='$normalized'";
    $result = $db->query($query);
    if (!$result)
    {
        record_login($normalized, $ip, $user_agent, LoginResult::ServerError);
        return json_error("Unexpected server error. Please try again");
    }

    if ($result->num_rows === 0)
    {
        record_login($normalized, $ip, $user_agent, LoginResult::BadUsername);
        return json_error("User does not exist. Would you like to <a href=register.php>register</a>?");
    }

    $row = $result->fetch_row();
    $result->close();
    $id = (int)$row[0];
    $user = $row[1];
    $hashed_pass = $row[3];
    $level = $row[4];

    if (!password_verify($password, $hashed_pass))
    {
        record_login($id, $ip, $user_agent, LoginResult::IncorrectPassword);
        return json_error("Incorrect password!");
    }

    session_start();
    record_login($id, $ip, $user_agent, LoginResult::Success);
    $query = "UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=$id";
    $db->query($query);

    $_SESSION['loggedin'] = TRUE;
    $_SESSION['id'] = $id;
    $_SESSION['username'] = $user;
    UserLevel::set_current($level);

    return json_success();
}

/// <summary>
/// Record a login attempt on success or failure
/// </summary>
function record_login($userid, $ip, $user_agent, $status)
{
    global $db;
    $query = "";
    if (is_string($userid))
    {
        // Invalid username that we can't map to an id - set the "invalid_username" field instead
        $query = "INSERT INTO logins (userid, invalid_username, ip, user_agent, status) VALUES (-1, '$userid', '$ip', '$user_agent', $status)";
    }
    else
    {
        $query = "INSERT INTO logins (userid, ip, user_agent, status) VALUES ($userid, '$ip', '$user_agent', $status)";
    }

    $db->query($query);
}

/// <summary>
/// Attempt to register a user
/// </summary>
function register($username, $password, $confirm)
{
    global $db;
    $username = trim($username);
    $normalized = $db->real_escape_string(strtolower($username));

    if (empty($username) || empty($password))
    {
        return json_error("Username/password cannot be empty!");
    }

    if (strlen($username) > 50)
    {
        return json_error("Username must be under 50 characters");
    }

    $query = "SELECT username_normalized FROM users WHERE username_normalized = '$normalized'";
    $result = $db->query($query);
    if (!$result)
    {
        return json_error("Unexpected server error. Please try again");
    }

    if ($result->num_rows > 0)
    {
        $result->close();
        return json_error("This user already exists!");
    }

    $result->close();
    if (strcmp($password, $confirm))
    {
        return json_error("Passwords do not match!");
    }

    $pass_hash = password_hash($password, PASSWORD_DEFAULT);
    $escaped_user_preserved = $db->real_escape_string($username);
    $query = "INSERT INTO users (username, username_normalized, password) VALUES ('$escaped_user_preserved', '$normalized', '$pass_hash')";
    $result = $db->query($query);
    if (!$result)
    {
        return json_error("Error entering name into database. Please try again");
    }

    $text_msg = "New user registered on Plex Requests!\r\n\r\nUsername: " . $username . "\r\nIP: " . $_SERVER["REMOTE_ADDR"];
    send_email_forget(ADMIN_PHONE, $text_msg, "" /*subject*/);
    return json_success();
}

/// <summary>
/// Determines whether the given user has already created a request for
/// media with the given external id. If it does exist, return the request,
/// otherwise return NULL
/// </summary>
function request_exists($external_id, $userid)
{
    global $db;
    $query = "SELECT id, request_name, satisfied FROM user_requests WHERE username_id=$userid AND external_id='$external_id'";
    $result = $db->query($query);
    if ($result && $result->num_rows != 0)
    {
        $row = $result->fetch_row();
        $existing_request = new \stdClass();
        $existing_request->exists = TRUE;
        $existing_request->rid = $row[0];
        $existing_request->name = $row[1];
        $existing_request->status = $row[2];
        return $existing_request;
    }

    return NULL;
}

/// <summary>
/// Add a new request, or returns an existing request if it has
/// the same external id.
/// </summary>
/// <param name="suggestion">The name of the request</param>
/// <param name="type">The type of request. Should map to common.php's RequestType</param>
/// <param name="external_id">The external (tmdb/audible) id for the new request</param>
/// <param name="poster">The path to the poster for this request</param>
function process_suggestion_new($suggestion, $type, $external_id, $poster)
{
    $type = RequestType::get_type_from_str($type);
    if (strlen($suggestion) > 128)
    {
        return json_error("Suggestion must be less than 128 characters");
    }

    if ($type === RequestType::None)
    {
        return json_error("Unknown media type: " . $_POST['mediatype']);
    }

    global $db;
    $userid = (int)$_SESSION['id'];
    $external_id = $db->real_escape_string($external_id);
    $existing_request = request_exists($external_id, $userid);
    if ($existing_request != NULL)
    {
        return json_encode($existing_request);
    }

    $suggestion = $db->real_escape_string($suggestion);
    $poster = $db->real_escape_string($poster);
    $query = "INSERT INTO user_requests (username_id, request_type, request_name, external_id, comment, poster_path) VALUES ($userid, $type, '$suggestion', '$external_id', '', '$poster')";
    if (!$db->query($query))
    {
        return db_error();
    }

    // Return the new entry's id
    $query = "SELECT id, request_date FROM user_requests WHERE request_name='$suggestion' AND username_id=$userid AND request_type=$type AND external_id='$external_id' ORDER BY request_date DESC";
    $result = $db->query($query);
    if ($result === FALSE)
    {
        return db_error();
    }

    $row = $result->fetch_assoc();
    $id = $row['id'];
    send_notifications_if_needed("create", get_user_from_request($id), $suggestion, "", $id, FALSE /*is_markdown*/);

    // Add an entry to the activity table
    if (!add_create_activity($id, $userid))
    {
        return db_error();
    }

    return "{ \"req_id\" : " . $id . " }";
}

/// <summary>
/// Process the given permission request. Currently only StreamAccess is supported
/// </summary>
function process_permission_request()
{
    $rt = RequestType::None;
    try
    {
        $rt = RequestType::get_type((int)get("req_type"));
    }
    catch (Exception $ex)
    {
        return json_error("Unable to process request type: " . get("req_type"));
    }

    switch ($rt)
    {
        case RequestType::StreamAccess:
            return process_stream_access_request(get("which"));
        default:
            return json_error("Unknown request type: " . get("req_type"));
    }
}

/// <summary>
/// Processes a stream access request.
///
/// If we're getting stream request status, print '0' if the user has not requested access, and '1' if they have
/// If we're requesting access, print '1' if the request was successful, '0' if the user has already requested access
/// </summary>
function process_stream_access_request($which)
{
    global $db;
    if ($which != 'get' && $which != 'req')
    {
        return json_error("Invalid 'which' parameter '" . $which . "' - must be 'get' or 'req'");
    }

    $get_only = strcmp($which, 'get') === 0;
    $userid = $_SESSION['id'];
    $query = "SELECT id, satisfied FROM user_requests WHERE username_id=$userid AND request_type=10";
    $result = $db->query($query);
    if ($result === FALSE)
    {
        return db_error();
    }

    if ($result->num_rows == 0)
    {
        $result->close();
        if ($get_only)
        {
            return '{ "value" : "Request Access" }';
        }

        $msg = try_get("msg");
        if (!$msg)
        {
            $msg = "";
        }

        $msg = $db->real_escape_string(mb_strimwidth($msg, 0, 1024));

        $query = "INSERT INTO user_requests (username_id, request_type, request_name, comment) VALUES ($userid, 10, 'ViewStream', '$msg')";
        $result = $db->query($query);
        if ($result === FALSE)
        {
            return db_error();
        }

        if (strlen($msg) != 0)
        {
            $query = "SELECT id FROM user_requests WHERE username_id=$userid AND request_type=10 AND request_name='ViewStream' ORDER BY request_date DESC";

            $result = $db->query($query);

            if (!$result)
            {
                return json_error("Error adding user comment");
            }

            $req_id = $result->fetch_row()[0];

            $query = "INSERT INTO request_comments (req_id, user_id, content) VALUES ($req_id, $userid, '$msg')";
            if (!$db->query($query))
            {
                return json_error("Error adding user comment");
            }

            $query = "INSERT INTO `activities` (`type`, `user_id`, `request_id`, `data`) VALUES (1, $userid, $req_id, '{}')";
            if (!$db->query($query))
            {
                return json_error("Error adding request to activity table");
            }
        }

        return '{ "value" : "Access Requested!" }';
    }
    else
    {
        $str = "";
        $row = $result->fetch_row();
        $id = $row[0];
        $status = (int)$row[1];
        $result->close();
        switch($status)
        {
            case 0:
                return '{ "value" : "Request Pending", "id" : ' . $id . ' }';
            case 1:
                return '{ "value" : "Request Approved" }';
            case 2:
                return '{ "value" : "Request Denied" }';
            case 3:
                return '{ "value" : "Request In Progress" }';
            case 4:
                return '{ "value" : "Request Waiting" }';
            default:
                return json_error("Unknown request status");
        }
    }
}

/// <summary>
/// Adds a comment to the given request.
/// </summary>
function add_request_comment($req_id, $content)
{
    global $db;
    $query = "SELECT username_id, request_name FROM user_requests WHERE id=$req_id";
    $result = $db->query($query);
    if ($result === FALSE || $result->num_rows === 0)
    {
        return json_error("bad request id");
    }

    $row = $result->fetch_row();
    $req_userid = (int)$row[0];
    $req_name = $row[1];
    if (!UserLevel::is_admin() && $_SESSION['id'] != $req_userid)
    {
        return json_error("Not Authorized");
    }

    (int)$userid = $_SESSION['id'];
    $content = $db->real_escape_string($content);
    $query = "INSERT INTO request_comments (req_id, user_id, content) VALUES ($req_id, $userid, '$content')";
    if (!$db->query($query))
    {
        return db_error();
    }

    $md_content = try_get("md");
    if ($md_content)
    {
        send_notifications_if_needed("comment", get_user_from_request($req_id), $req_name, $md_content, $req_id, TRUE /*is_markdown*/);
    }
    else
    {
        send_notifications_if_needed("comment", get_user_from_request($req_id), $req_name, $content, $req_id, FALSE /*is_markdown*/);
    }

    // Need to get the ID of this comment to add it to the activity table
    $query = "SELECT `id` FROM request_comments WHERE `req_id`=$req_id AND `user_id`=$userid AND `content`='$content' ORDER BY `timestamp` DESC";

    $result = $db->query($query);
    if (!$result)
    {
        return json_error("Successfully added the comment, but failed to query for it");
    }
    else if ($result->num_rows == 0)
    {
        return json_error("Successfully added the comment, but now we can't find it");
    }

    $row = $result->fetch_assoc();
    $id = $row['id'];
    if (!add_comment_activity($id, $req_id, $req_userid, $userid))
    {
        return db_error();
        // return json_error("Successfully added the comment, but failed to add it to the activity table");
    }

    return json_success();
}

/// <summary>
/// Return all comments for the given request
/// </summary>
function get_request_comments($req_id)
{
    global $db;
    $query = "SELECT username_id FROM user_requests WHERE id=$req_id";
    $result = $db->query($query);
    if ($result === FALSE || $result->num_rows === 0)
    {
        return json_error("bad request id");
    }

    $uid = $_SESSION['id'];
    $req_userid = (int)$result->fetch_row()[0];
    if (!UserLevel::is_admin() && $uid != $req_userid)
    {
        return json_error("Not Authorized");
    }

    $query = "SELECT u.username AS user, c.content AS content, c.timestamp AS time, u.id=$uid AS editable, c.id AS id, c.last_edit AS last_edit FROM `request_comments` c INNER JOIN `users` u ON c.user_id=u.id WHERE c.req_id=$req_id ORDER BY c.timestamp ASC";
    $result = $db->query($query);
    if ($result === FALSE)
    {
        return json_error($db->error);
    }

    $rows = array();

    while ($r = $result->fetch_assoc())
    {
        $rows[] = $r;
    }

    return json_encode($rows);
}

/// <summary>
/// Updates the user information. Populates $error on failure
/// </summary>
function update_user_settings($firstname, $lastname, $email, $emailalerts, $phone, $phonealerts, $carrier)
{
    global $db;
    try
    {
        $emailRegex = '/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/';
        // Just show one error at a time
        if (strlen($firstname) > 128)
        {
            return json_error("First name must be less than 128 characters");
        }
        else if (strlen($lastname) > 128)
        {
            return json_error("Last name must be less than 128 characters");
        }
        else if (strlen($email) > 256)
        {
            return json_error("Email must be less than 256 characters");
        }
        else if (!empty($email) && !preg_match($emailRegex, $email))
        {
            return json_error("Invalid email address");
        }
        else if (!empty($phone) && strlen($phone) != 10 && strlen($phone) != 11)
        {
            return json_error("Invalid phone number");
        }
        else if (strcmp($carrier, "verizon") && strcmp($carrier, "att") && strcmp($carrier, "tmobile") && strcmp($carrier, "sprint"))
        {
            return json_error("Invalid phone carrier");
        }

        $firstname = $db->real_escape_string($firstname);
        $lastname = $db->real_escape_string($lastname);
        $email = $db->real_escape_string($email);
        $emailalerts = (!empty($email) && !strcmp($emailalerts, "true")) ? "TRUE" : "FALSE";
        $phonealerts = (!empty($phone) && !strcmp($phonealerts, "true")) ? "TRUE" : "FALSE";
        $phone = (int)$phone;
        $carrier = $db->real_escape_string($carrier);
        $userid = (int)$_SESSION['id'];

        $query = "UPDATE user_info SET firstname='$firstname', lastname='$lastname', email='$email', email_alerts=$emailalerts, phone=$phone, phone_alerts=$phonealerts, carrier='$carrier' WHERE userid=$userid";
        $result = $db->query($query);
        if (!$result)
        {
            return db_error();
        }

        return json_success();
    }
    catch (Exception $e)
    {
        return json_error("Unexpected error occurred. Please try again later");
    }
}


/// <summary>
/// Send email and text notifications if the user has requested them
/// </summary>
function send_notifications_if_needed($type, $requester, $req_name, $content, $req_id, $is_markdown)
{
    if ($type != "create" && $requester->id == $_SESSION['id'] && !UserLevel::is_admin())
    {
        return;
    }

    $text = "";
    $email = "<html><body style='background-color:#313131;color=#c1c1c1'><div>";
    $max_text = 160;
    $domain = SITE_SHORT_DOMAIN;
    switch ($type)
    {
        case "comment":
            $text = "A comment has been added your your request for $req_name. See it here: https://$domain/r/$req_id";
            if ($text > $max_text)
            {
                $text = "A comment has been added to one of your requests. See it here: https://$domain/r/$req_id";
            }

            // Don't bother with the expensive email creation if we won't even be sending an email
            if (!$requester->info->email_alerts || empty($requester->info->email))
            {
                break;
            }

            // Emails have more formatting and also displays markdown correctly
            $style_noise = 'url("https://' . $domain . '/res/noise.8b05ce45d0df59343e206bc9ae78d85d.png")';
            $email_style = '<style>.markdownEmailContent { background: rgba(0,0,0,0) ' . $style_noise . ' repeat scroll 0% 0%; ';
            $email_style .= 'color: #c1c1c1 !important; border: 5px solid #919191; } ';
            $email_style .= '.md { color: #c1c1c1 !important; } ';
            $email_style .= '.h1Title { margin-top: 0; padding: 20px; border-bottom: 5px solid #919191; } ';
            $email_style .= '</style>';

            $body_background = "url('https://$domain/res/preset-light.770a0981b66e038d3ffffbcc4f5a26a4.png')";

            $subheader = '<h3 style="padding: 0 20px 0 20px;">A comment has been added to your request for ' . $req_name . ':</h3>';

            $email = '<html><head><style>' . file_get_contents("style/markdown.css") . '</style>';
            $email .= $email_style;
            $email .= '</head><body style="background-image: ' . $body_background . '; background-size: cover;">';
            $email .=   '<div class="markdownEmailContent">';
            $email .=     '<h1 class="h1Title">New Comment</h1>';
            $email .=     $subheader;
            $email .=     '<div class="md" style="padding: 0 20px 20px 20px"><div style="padding-left: 20px">';
            $email .=        $content;
            $email .=     '</div><br>';
            $email .=     "View your request <a href='https://$domain/request.php?id=$req_id'>here</a>.";
            $email .=   '</div>';
            $email .= '</div></body></html>';
            break;
        case "status":
            // This has moved to update_request.php. We should really consolidate the update request
            // logic, since there's a good chunk of dead code between the two implementations
            $text = "The status of your request has changed:\nRequest: " . $req_name . "\nStatus: $content\n\nhttps://$domain/request.php?id=$req_id";
            $email = "<div>The status of your request for $req_name has changed: $content</div><br />";
            $email .= "<br />View your request here: https://$domain/request.php?id=$req_id";
            $email .= "</div></body></html>";
            break;
        case "create":
            $text = "$requester->username created a request for $req_name. See it here: https://$domain/r/$req_id";
            if ($text > $max_text)
            {
                $text = "Someone created a new request. See it here: https://$domain/r/$req_id";
            }
            $email = $text;
            break;
        default:
            return json_error("Unknown notification type: " . $type);
    }

    if ($type != "create")
    {
        send_notification($requester, $text, $email);
        return json_success();
    }
    else
    {
        $admins = get_admins();
        foreach ($admins as $admin)
        {
            send_notification($admin, $text, $email);
        }
    }

    return json_success();
}

/// <summary>
/// Return a phone number's associated SMS email
/// </summary>
function get_phone_email($phone, $carrier, &$error)
{
    $error = FALSE;
    switch ($carrier)
    {
        case "verizon":
            return $phone . "@vtext.com";
        case "tmobile":
            return $phone . "@tmomail.net";
        case "att":
            return $phone . "@txt.att.net";
        case "sprint":
            return $phone . "@messaging.sprintpcs.com";
        default:
            $error = TRUE;
            return "";
    }
}

/// <summary>
/// Send notifications to the given requester.
/// </summary>
/// <param name="text">The notification if being sent to a phone number</param>
/// <param name="email">The notification text if being sent to an email</param>
function send_notification($requester, $text, $email)
{
    if ($requester->info->phone_alerts && $requester->info->phone != 0)
    {
        $to = "";
        $phone = $requester->info->phone;
        $error = FALSE;
        $to = get_phone_email($phone, $requester->info->carrier, $error);
        if ($error)
        {
            return json_error("Unknown carrier: " . $requester->info->carrier);
        }

        $subject = "";
        send_email_forget($to, $text, $subject);
    }

    if ($requester->info->email_alerts && !empty($requester->info->email))
    {
        $subject = "Plex Request Update";
        send_email_forget($requester->info->email, $email, $subject);
    }

}

/// <summary>
/// Returns the user who submitted the given request
/// </summary>
function get_user_from_request($req_id)
{
    global $db;
    $user = new \stdClass();
    $query = "SELECT u.id, u.username, u.level, i.firstname, i.lastname, i.email, i.email_alerts, i.phone, i.phone_alerts, i.carrier
              FROM user_requests
                  INNER JOIN users u ON user_requests.username_id=u.id
                  INNER JOIN user_info i ON u.id = i.userid
              WHERE user_requests.id=$req_id";
    $result = $db->query($query);
    if (!$result || $result->num_rows === 0)
    {
        $user->id = -1;
        return $user;
    }

    $row = $result->fetch_row();
    $user->id = $row[0];
    $user->username = $row[1];
    $user->level = $row[2];
    $user->info = new \stdClass();
    $user->info->firstname = $row[3];
    $user->info->lastname = $row[4];
    $user->info->email = $row[5];
    $user->info->email_alerts = $row[6];
    $user->info->phone = $row[7];
    $user->info->phone_alerts = $row[8];
    $user->info->carrier = $row[9];

    $result->close();
    return $user;
}

/// <summary>
/// Return user information for all admins
/// </summary>
function get_admins()
{
    global $db;
    $admins = array();
    $admin_level = UserLevel::Admin;
    $query = "SELECT u.id, u.username, u.level, i.firstname, i.lastname, i.email, i.email_alerts, i.phone, i.phone_alerts, i.carrier
              FROM users u
                INNER JOIN user_info i on u.id=i.userid
              WHERE u.level >= $admin_level";
    $result = $db->query($query);

    while ($row = $result->fetch_row())
    {
        $user = new \stdClass();
        $user->id = $row[0];
        $user->username = $row[1];
        $user->level = $row[2];
        $user->info = new \stdClass();
        $user->info->firstname = $row[3];
        $user->info->lastname = $row[4];
        $user->info->email = $row[5];
        $user->info->email_alerts = $row[6];
        $user->info->phone = $row[7];
        $user->info->phone_alerts = $row[8];
        $user->info->carrier = $row[9];

        $admins[] = $user;
    }

    $result->close();

    return $admins;
}

/// <summary>
/// Retrieves the current user's information
/// </summary>
function get_user_settings()
{
    global $db;
    $userid = (int)$_SESSION["id"];
    $query = "SELECT * FROM user_info WHERE userid=$userid";
    $result = $db->query($query);
    if (!$result || $result->num_rows != 1)
    {
        return json_error("Failed to retrieve user settings");
    }

    $row = $result->fetch_row();
    $json = new \stdClass();
    $json->firstname = $row[2];
    $json->lastname = $row[3];
    $json->email = $row[4];
    $json->emailalerts = $row[5];
    $json->phone = $row[6];
    $json->phonealerts = $row[7];
    $json->carrier = $row[8];

    $result->close();

    return json_encode($json);
}

/// <summary>
/// Checks whether a given username exists
/// </summary>
function check_username($username)
{
    global $db;
    $check = $db->real_escape_string(strtolower(get("username")));
    $result = $db->query("SELECT username FROM users where username_normalized='$check'");
    if (!$result || $result->num_rows !== 0)
    {
        return '{ "value" : 0 }';
    }
    else
    {
        $result->close();
        return '{ "value" : 1, "name" : "' . get("username") . '" }';
    }
}

/// <summary>
/// Return a list of all members registered on the site
/// </summary>
function get_members_all()
{
    if (!UserLevel::is_admin())
    {
        return json_error('Not authorized');
    }

    global $db;
    $query = "SELECT id, username FROM users ORDER BY username ASC";
    $result = $db->query($query);
    if (!$result)
    {
        return db_error();
    }

    $users = array();
    while ($row = $result->fetch_row())
    {
        $user = new \stdClass();
        $user->id = $row[0];
        $user->username = $row[1];
        array_push($users, $user);
    }

    $result->close();
    return json_encode($users);
}

/// <summary>
/// Returns a json string of members, sorted by the last time they logged in
/// </summary>
function get_members($num, $page, $search, $filter)
{
    if (!UserLevel::is_admin())
    {
        return json_error("Not authorized");
    }

    global $db;

    $offset = $num == 0 ? 0 : $num * $page;
    $filter = json_decode($filter);
    $query = "SELECT users.id AS id, username, level, last_login, created_at, firstname, lastname, email, phone, email_alerts, phone_alerts FROM users INNER JOIN user_info ON users.id=user_info.userid ";

    $filter_string = "WHERE 1 ";
    $admin_level = UserLevel::Admin;
    if (!$filter->type->new)
    {
        $filter_string .= "AND level <> 0 ";
    }
    if (!$filter->type->regular)
    {
        $filter_string .= "AND (level = 0 OR level >= $admin_level) ";
    }
    if (!$filter->type->admin)
    {
        $filter_string .= "AND level < $admin_level ";
    }

    if ($filter->pii != "all")
    {
        if ($filter->pii == 'yes')
        {
            $filter_string .= "AND (firstname <> '' OR lastname <> '' OR email <> '' OR phone <> 0) ";
        }
        else
        {
            $filter_string .= "AND firstname = '' AND lastname = '' AND email = '' AND phone = 0 ";
        }
    }

    if (strlen($search) > 0)
    {
        $search = $db->real_escape_string($search);
        $filter_string .= "AND username LIKE '%$search%' ";
    }

    $query .= $filter_string . "ORDER BY ";
    switch ($filter->sort)
    {
        case "id":
            $query .= "id ";
            break;
        case "name":
            $query .= "username ";
            break;
        case "seen":
            $query .= "last_login ";
            break;
        case "level":
            $query .= "level ";
            break;
        default:
            return json_error('Invalid filter sort field');
    }

    $query .= $filter->order . " ";
    if ($num != 0)
    {
        $query .= "LIMIT $num ";
    }

    if ($offset != 0)
    {
        $query .= "OFFSET $offset";
    }

    $result = $db->query($query);
    if (!$result)
    {
        return db_error();
    }

    $members = new \stdClass();
    $users = array();
    while ($row = $result->fetch_row())
    {
        $user = new \stdClass();
        $user->id = $row[0];
        $user->username = $row[1];
        $user->level = $row[2];
        $user->last_seen = $row[3];
        $user->created = $row[4];
        $user->name = $row[5] . ' ' . $row[6];
        $user->email = $row[7];
        $user->phone = $row[8];
        $user->emailalerts = $row[9];
        $user->phonealerts = $row[10];
        array_push($users, $user);
    }

    $members->data = $users;

    $result->close();

    $query = "SELECT COUNT(*) FROM users INNER JOIN user_info ON users.id=user_info.userid " . $filter_string;
    $result = $db->query($query);
    if (!$result)
    {
        return db_error();
    }

    $members->total = (int)$result->fetch_row()[0];

    return json_encode($members);
}

/// <summary>
/// Perform a search against the plex server
/// </summary>
function search($query, $kind)
{
    if (UserLevel::current() < UserLevel::Regular)
    {
        return json_error("Not authorized");
    }

    $query = strtolower(trim($query));
    $type = strtolower(RequestType::get_type_from_str($kind));

    $libraries = simplexml_load_string(curl(PLEX_SERVER . '/library/sections?' . PLEX_TOKEN))->xpath("Directory");

    $type_str = "";
    if ($type == RequestType::Movie)
    {
        $type_str = "movies";
    }
    else if ($type == RequestType::TVShow)
    {
        $type_str = "tv shows";
    }
    else if ($type == RequestType::AudioBook)
    {
        $type_str = "audiobooks";
    }
    else if ($type == RequestType::Music)
    {
        $type_str = "music";
    }
    else
    {
        return json_error("Unknown media category: " . $type);
    }

    $section = -1;
    foreach ($libraries as $library)
    {
        if (strtolower($library['title']) == $type_str)
        {
            $section = $library['key'];
        }
    }

    if ($section == -1)
    {
        return json_error("Could not find category '" . $type_str . "'");
    }

    $prefix = ($type == RequestType::AudioBook ? "albums" : "all");
    $url = PLEX_SERVER . "/library/sections/" . $section . "/" . $prefix . "?" . PLEX_TOKEN;
    $url .= '&title=' . urlencode($query) . '&sort=addedAt:desc';
    $results = simplexml_load_string(curl($url));
    $existing = array();

    foreach ($results as $result)
    {
        $item = new \stdClass();
        $item->title = (string)$result['title'];
        if ($result['thumb'])
        {
            $item->thumb = 'thumb' . $result['thumb'];
        }
        $item->year = (string)$result['year'];
        $item->imdbid = get_imdb_link_from_guid((string)$result['guid'], $type);
        if (RequestType::is_audio($type))
        {
            // Todo - search Audible/music apis?
        }
        else
        {
            $copies = $result->xpath('Media');
            $resolutions = array();
            foreach ($copies as $file)
            {
                $res = (string)$file['videoResolution'];
                if ($res)
                {
                    $lastChar = $res[strlen($res) - 1];
                    if ($lastChar != 'k' && $lastChar != 'p' && $lastChar != 'i' && $lastChar != 'd')
                    {
                        $res .= 'p';
                    }

                    $resolutions[$res] = TRUE;
                }
            }
            if (count($resolutions) > 0)
            {
                $item->resolution = join(', ', array_keys($resolutions));
            }

            if ($type == RequestType::TVShow)
            {
                $item->tvChildPath = (string)$result['key'];
            }
        }

        array_push($existing, $item);
        if (sizeof($existing) == 5)
        {
            break;
        }
    }

    $final_obj = new \stdClass();
    $final_obj->length = sizeof($results);
    $final_obj->top = $existing;
    return json_encode($final_obj);
}

/// <summary>
/// Extract a media id from a plex guid
/// </summary>
function extract_id_from_guid($guid)
{
    $guid = substr($guid, strpos($guid, '://') + 3);
    if (($lang = strpos($guid, '?')) != -1)
    {
        return substr($guid, 0, $lang);
    }

    return $guid;
}

/// <summary>
/// Returns the imdb id associated with the the given guid.
/// If the guid isn't associated with imdb, do some extra
/// processing to figure out what the imdb id is.
/// </summary>
function get_imdb_link_from_guid($guid, $type)
{
    global $db;
    $id = extract_id_from_guid($guid);
    if (strpos($guid, "imdb") !== FALSE)
    {
        return $id;
    }

    if (strpos($guid, "themoviedb") !== FALSE || strpos($guid, "tmdb") !== FALSE)
    {
        $query = "SELECT imdb_id FROM tmdb_cache WHERE tmdb_id=$id";
        $result = $db->query($query);
        if ($result && $result->num_rows == 1)
        {
            return $result->fetch_row()[0];
        }

        $endpoint = 'movie/';
        if ($type == RequestType::TVShow)
        {
            $endpoint = 'tv/';
        }

        $url = TMDB_URL . 'movie/' . $id . TMDB_TOKEN;
        // $url = $_SERVER["HTTP_REFERER"] . 'media_search.php?type=1&query=' . $tmdb . '&by_id=true';
        $imdb = json_decode(curl($url))->imdb_id;
        $result = $db->query("INSERT INTO tmdb_cache (tmdb_id, imdb_id) VALUES ($id, '$imdb')");
        return $imdb;
    }

    if (strpos($guid, "thetvdb") != -1)
    {
        $query = "SELECT imdb_link FROM imdb_tv_cache WHERE show_id=$id AND season=-1 AND episode=-1";
        $result = $db->query($query);
        if ($result && $result->num_rows == 1)
        {
            return $result->fetch_row()[0];
        }

        $tvdb_client = new Tvdb();
        if (!$tvdb_client->ready())
        {
            return $guid;
        }

        $imdb = $tvdb_client->get_series($id)->getImdbLink();
        $result = $db->query("INSERT INTO imdb_tv_cache (show_id, season, episode, imdb_link) VALUES ($id, -1, -1, '$imdb')");
        return $imdb;
    }

    // Unknown agent. Just return the id if we can
    return $id;
}

/// <summary>
/// Returns information about what seasons are available on plex versus total seasons
/// </summary>
function get_season_details($path)
{
    $details = new \stdClass();
    $details->path = $path;
    $seasonStatus = array();
    $children = simplexml_load_string(curl(PLEX_SERVER . $path . '?' . PLEX_TOKEN));
    $totalSeasons = 0;
    $seasons = $children->xpath('Directory');

    $tvdb_client = new Tvdb();
    foreach ($seasons as $season)
    {
        if (!$season['type'] || $season['type'] != 'season')
        {
            continue;
        }

        $data = new \stdClass();
        $data->season = (int)$season['index'];
        $episodePath = $season['key'];
        $episodes = simplexml_load_string(curl(PLEX_SERVER . $episodePath . '?' . PLEX_TOKEN));
        $availableEpisodes = count($episodes);

        if (isset($season['guid']) && strpos($season['guid'], 'thetvdb') !== FALSE)
        {
            $seasonGuid = substr($season['guid'], strpos($season['guid'], 'thetvdb') + 10);
            $seasonGuid = substr($seasonGuid, 0, strpos($seasonGuid, '/'));
            if (!$tvdb_client->ready())
            {
                $tvdb_client->login();
            }

            if ($totalSeasons == 0)
            {
                $details->totalSeasons = $tvdb_client->get_series($seasonGuid)->getSeasonCount();
            }

            $totalEpisodes = count($tvdb_client->get_season_episodes($seasonGuid, $data->season));

            // Say we're complete if we have at least as many episodes as TVDb says there are in the season
            $data->complete = $totalEpisodes <= $availableEpisodes;
        }
        else
        {
            $data->unknown = TRUE;
        }
        $seasonStatus[] = $data;
    }

    $details->seasons = $seasonStatus;
    return json_encode($details);
}

/// <summary>
/// Search for a movie or tv show via IMDb.
/// </summary>
function search_external($query, $kind)
{
    $query = strtolower(trim($query));
    $letter = substr($query, 0, 1);
    $type = strtolower(RequestType::get_type_from_str($kind));

    if ($type != RequestType::Movie && $type != RequestType::TVShow)
    {
        $text = curl("https://www.audible.com/search?keywords=" . $query);
        $find = strpos($text, "productListItem");
        if ($find === FALSE)
        {
            $obj = new \stdClass();
            $obj->length = 0;
            $obj->top = array();
            return json_encode($obj);
        }

        $results = array();
        while ($find !== FALSE && sizeof($results) < 5)
        {
            $title_start = strpos($text, "aria-label='", $find) + 12;
            $title_end = strpos($text, "'", $title_start);
            $title = html_entity_decode(substr($text, $title_start, $title_end - $title_start), ENT_QUOTES | ENT_HTML5);

            $ref_find = strpos($text, "bc-color-link", $title_end);
            $ref_start = strpos($text, "href=\"", $ref_find) + 6;
            $ref_end = strpos($text, "?", $ref_start);
            $ref = "https://audible.com" . substr($text, $ref_start, $ref_end - $ref_start);

            $id_start = strrpos($ref, "/") + 1;
            $id = substr($ref, $id_start);

            $img_find = strpos($text, "bc-image-inset-border", $find);
            $img_start = strpos($text, "src=", $img_find) + 5;
            $img_end = strpos($text, "\"", $img_start);
            $img = substr($text, $img_start, $img_end - $img_start);

            $rel_start = strpos($text, "Release date:", $img_find) + 13;
            $rel_end = strpos($text, "</span", $rel_start);
            $rel = str_replace("\n", "", str_replace(" ", "", substr($text, $rel_start, $rel_end - $rel_start)));

            $item = new \stdClass();
            $item->title = $title;
            $item->year = $rel;
            $item->thumb = $img;
            $item->id = $id;
            $item->ref = $ref;

            array_push($results, $item);

            $find = strpos($text, "productListItem", $rel_end);
        }

        $final_obj = new \stdClass();
        $final_obj->length = sizeof($results);
        $final_obj->top = $results;

        return json_encode($final_obj);
    }

    $url = "https://v2.sg.media-imdb.com/suggests/" . urlencode($letter) . "/" . urlencode($query) . ".json";
    $response = curl($url);
    if (strtolower(substr($response, 0, 5)) == "imdb$")
    {
        $index = strpos($response, "(") + 1;
        $length = strlen($response) - $index;
        $response = substr($response, $index, $length - 1);

        $results = array();
        $response = json_decode($response, true)['d'];

        $len = sizeof($response);

        foreach ($response as $result)
        {
            if (substr($result['id'], 0, 2) != "tt" || !isset($result['q']))
            {
                // Not a movie/show
                --$len;
                continue;
            }

            if ($type == RequestType::Movie && $result['q'] != "feature")
            {
                // Movie type (q) is 'feature'
                --$len;
                continue;
            }
            else if ($type == RequestType::TVShow && strtolower($result['q']) != "tv series")
            {
                --$len;
                continue;
            }

            if (!isset($result['y']) || !isset($result['i']))
            {
                // No year/thumbnail == no entry
                --$len;
                continue;
            }

            $item = new \stdClass();
            $item->title = $result['l'];
            $item->year = $result['y'];
            $item->thumb = $result['i'][0];
            $item->id = $result['id'];
            $item->ref = "https://imdb.com/title/" . $result['id'];
            array_push($results, $item);

            if (sizeof($results) == 5)
            {
                break;
            }
        }

        $final_obj = new \stdClass();
        $final_obj->length = $len;
        $final_obj->top = $results;
        return json_encode($final_obj);
    }
    else
    {
        return json_error("Unknown IMDb error: " . $response);
    }
}

/// <summary>
/// Attempt to update a user's password, failing if the old password is incorrect,
/// the old password matches the new password, or the new password doesn't match it's confirmation
/// </summary>
function update_password($old_pass, $new_pass, $conf_pass)
{
    global $db;

    // First, verify that the old password they entered is correct
    $escaped_user_preserved = $db->real_escape_string($_SESSION['username']);
    $query = "SELECT password FROM users WHERE username='$escaped_user_preserved'";
    $result = $db->query($query);
    if (!$result || $result->num_rows != 1)
    {
        return db_error();
    }

    $old_hash = $result->fetch_row()[0];
    $result->close();
    if (!password_verify($old_pass, $old_hash))
    {
        return json_error("Old password is incorrect!");
    }

    if ($old_pass == $new_pass)
    {
        return json_error("New password must be different from current password!");
    }

    if ($new_pass != $conf_pass)
    {
        return json_error("Passwords don't match!");
    }

    $new_pass_hash = password_hash($new_pass, PASSWORD_DEFAULT);
    $query = "UPDATE users SET password='$new_pass_hash' WHERE username='$escaped_user_preserved'";
    $result = $db->query($query);
    if (!$result)
    {
        return db_error();
    }

    return json_success();
}

/// <summary>
/// Return the location and ISP (sorta) information for the given IP address
/// </summary>
function get_geo_ip($ip)
{
    global $db;
    $ip_safe = $db->real_escape_string($ip);

    # timestamp will return the local time by default, but 'new DateTime' returns UTC
    $query = "SELECT city, state, country, isp, CONVERT_TZ(timestamp, @@session.time_zone, '+00:00') AS `utc_timestamp` FROM ip_cache WHERE ip='$ip_safe'";
    $exists = FALSE;
    $result = $db->query($query);
    if ($result && $result->num_rows == 1)
    {
        $exists = TRUE;
        $row = $result->fetch_row();
        $result->close();

        $timestamp = new DateTime($row[4]);
        $now = new DateTime(date("Y-m-d H:i:s"));
        $diff = ($now->getTimestamp() - $timestamp->getTimestamp()) / 60;

        // Free tier is limited to 1500 api calls a day, so don't continuously ping them
        // Keeping the value around for 30 minutes gives us a large buffer of ~31 unique
        // IP addresses per 30 minute chunk.
        if ($diff <= 30)
        {
            // Less than 30 minutes since our last query. Use the cached value
            $json = new \stdClass();
            $json->city = $row[0];
            $json->state = $row[1];
            $json->country = $row[2];
            $json->isp = $row[3];
            $json->cached = TRUE;
            return json_encode($json);
        }
    }

    // If we have no cached value or our cached value is out of date, grab
    // it from the actual API
    $json = json_decode(curl(GEOIP_URL . $ip));
    if ($json == NULL)
    {
        return json_error("Failed to parse geoip response");
    }

    // We only care about certain fields
    $trimmed_json = new \stdClass();
    $trimmed_json->country = $json->country_name;
    $trimmed_json->state = $json->state_prov;
    $trimmed_json->city = $json->city;
    $trimmed_json->isp = $json->isp;
    $trimmed_json->cached = FALSE;

    $country = $db->real_escape_string($trimmed_json->country);
    $state = $db->real_escape_string($trimmed_json->state);
    $city = $db->real_escape_string($trimmed_json->city);
    $isp = $db->real_escape_string($trimmed_json->isp);
    $query = $exists ?
        "UPDATE ip_cache SET city='$city', state='$state', country='$country', isp='$isp', query_count=query_count+1 WHERE ip='$ip_safe'" :
        "INSERT INTO ip_cache (ip, city, state, country, isp) VALUES ('$ip_safe', '$city', '$state', '$country', '$isp')";

    $db->query($query);
    return json_encode($trimmed_json);
}

/// <summary>
/// Set the external id of a request. Used when upgrading a legacy
/// request to a modern one
/// </summary>
function set_external_id($req_id, $ext_id)
{
    global $db;
    $ext_id = $db->real_escape_string($ext_id);
    $query = "UPDATE user_requests SET external_id='$ext_id' WHERE id=$req_id";
    $db->query($query);
    return json_success();
}

/// <summary>
/// Return the next available request for the current user.
/// </summary>
/// <param name="forward">Direction to search, with true indicating moving forward in time</param>
function get_next_req($cur_id, $forward)
{
    global $db;
    if ($forward != 0 && $forward != 1)
    {
        return json_error("Bad direction. Expecting 0 or 1");
    }

    $query = "";
    $sort = $forward == 0 ? "DESC" : "ASC";
    $cmp = $forward == 0 ? "<" : ">";
    if (UserLevel::is_admin())
    {
        $query = "SELECT id FROM user_requests WHERE id " . $cmp . $cur_id . " ORDER BY id " . $sort . " LIMIT 1";
    }
    else
    {
        $query = "SELECT id FROM user_requests WHERE id " . $cmp . $cur_id . " AND username_id = " . $_SESSION["id"] . " ORDER BY id " . $sort . " LIMIT 1";
    }

    $result = $db->query($query);
    if (!$result || $result->num_rows == 0)
    {
        return '{"new_id":-1}';
    }

    return '{"new_id":' . $result->fetch_row()[0] . "}";
}

/// <summary>
/// Get all requests that match the given filter
/// </summary>
/// <param name="num">The number of requests to return. If 0, return all matching requests</param>
/// <param name="page">The page number to return, i.e. skip the first (num * page) requests</param>
/// <param name="search">Search string to substring match against request titles. Can be empty</param>
/// <param name="filter">The filter to apply when querying for requests</param>
function get_requests($num, $page, $search, $filter)
{
    global $db;
    $id = (int)$_SESSION['id'];
    $offset = $num == 0 ? 0 : $num * $page;
    $filter = json_decode($filter);

    $query = "SELECT request_name, users.username, request_type, satisfied, request_date, satisfied_date, user_requests.id, users.id, external_id, internal_id, poster_path, comment_count FROM user_requests INNER JOIN users ON user_requests.username_id=users.id ";

    $filter_status = array();
    if ($filter->status->pending)
    {
        array_push($filter_status, "satisfied=0");
    }
    if ($filter->status->complete)
    {
        array_push($filter_status, "satisfied=1");
    }
    if ($filter->status->declined)
    {
        array_push($filter_status, "satisfied=2");
    }
    if ($filter->status->inprogress)
    {
        array_push($filter_status, "satisfied=3");
    }
    if ($filter->status->waiting)
    {
        array_push($filter_status, "satisfied=4");
    }

    $filter_type = array();
    if ($filter->type->movies)
    {
        array_push($filter_type, "request_type=1");
    }
    if ($filter->type->tv)
    {
        array_push($filter_type, "request_type=2");
    }
    if ($filter->type->audiobooks)
    {
        array_push($filter_type, "request_type=3");
    }
    if ($filter->type->other)
    {
        array_push($filter_type, "request_type=10");
    }

    if (count($filter_status) == 0 || count($filter_type) == 0)
    {
        // Filter removes all items, just return an empty object
        $requests = new \stdClass();
        $requests->count = 0;
        $requests->entries = array();
        $requests->total = 0;
        return json_encode($requests);
    }

    $filter_status_string = join(" OR ", $filter_status);
    $filter_type_string = join(" OR ", $filter_type);
    $filter_string = "";
    if (!UserLevel::is_admin())
    {
        $filter_string =
        "WHERE user_requests.username_id=$id AND ("
        . $filter_status_string
        . ") AND ("
        . $filter_type_string
        . ") ";
    }
    else
    {
        $filter_string = " WHERE (" . $filter_status_string . ") AND (" . $filter_type_string . ") ";

        $user = (int)$filter->user;
        if ($user != -1)
        {
            $filter_string .= "AND (user_requests.username_id=$user) ";
        }
    }

    if (strlen($search) > 0)
    {
        $search = $db->real_escape_string($search);
        $filter_string .= "AND (request_name LIKE '%$search%') ";
    }

    $query .= $filter_string;
    $query .= "ORDER BY ";
    $reverse = FALSE;
    switch ($filter->sort)
    {
        case "request":
            $query .= "user_requests.id ";
            break;
        case "update":
            $query .= "user_requests.satisfied_date ";
            break;
        case "title":
            $query .= "user_requests.request_name ";
            $reverse = TRUE;
            break;
        default:
            return json_error("Invalid sort option");
    }

    switch ($filter->order)
    {
        case "desc":
            $query .= ($reverse ? "ASC " : "DESC ");
            break;
        case "asc":
            $query .= ($reverse ? "DESC " : "ASC ");
            break;
        default:
            return json_error("Invalid sort order");
    }

    if ($num != 0)
    {
        $query .= "LIMIT $num ";
    }

    if ($offset != 0)
    {
        $query .= "OFFSET $offset";
    }

    $result = $db->query($query);
    {
        if (!$result)
        {
            return db_error();
        }
    }

    $requests = new \stdClass();
    $requests->count = $result->num_rows;
    $requests->entries = array();
    $requests->machine_id = get_plex_server();
    while ($row = $result->fetch_row())
    {
        $request = new \stdClass();
        $request->n = $row[0]; // Request Name
        $request->r = $row[1]; // Requester
        $request->t = $row[2]; // Request Type
        $request->a = $row[3]; // Addressed
        $request->rd = $row[4]; // Request Date
        $request->ad = $row[5]; // Addressed Date
        $request->rid = $row[6]; // Request ID
        $request->uid = $row[7]; // Requester ID
        $request->eid = $row[8]; // External ID
        $request->pid = $row[9]; // Internal/Plex ID
        $request->c = $row[11]; // Comment count
        $poster_path = $row[10]; // Poster
        if (!$poster_path)
        {
            // If we don't have a poster path, get it
            $poster_path = get_poster_path($request->t, $request->eid, $request->rid);
        }

        if (is_null($request->pid))
        {
            $request->pid = -1;
        }

        if ($poster_path)
        {
            $request->p = $poster_path;
        }

        array_push($requests->entries, $request);
    }

    $query = "SELECT COUNT(*) FROM user_requests " . $filter_string;
    $result = $db->query($query);
    if (!$result)
    {
        return db_error();
    }

    $requests->total = (int)$result->fetch_row()[0];

    return json_encode($requests);
}

/// <summary>
/// Gets the poster path for the given request. If none is found,
/// falls back to default posters. If it is found, cache it in the
/// request.
/// </summary>
function get_poster_path($type, $external_id, $request_id)
{
    global $db;
    $type = RequestType::get_type((int)$type);
    $json = NULL;
    $continue = false;

    // Some early requests don't have an external id. Don't try
    // to get a poster for a null item, as it will fail anyway
    if ($external_id)
    {
        switch ($type)
        {
            case RequestType::Movie:
                $json = run_query("movie/" . $external_id);
                break;
            case RequestType::TVShow:
                $json = run_query("tv/" . $external_id);
                break;
            case RequestType::AudioBook:
                break;
            default:
                $continue = TRUE;
                break;
        }
    }

    if ($continue)
    {
        return "/viewstream.svg";
    }

    // Our search didn't return anything. Revert to defaults
    if ($json == NULL)
    {
        switch ($type)
        {
            case RequestType::Movie:
                return "/moviedefault.svg";
            case RequestType::TVShow:
                return "/tvdefault.svg";
            case RequestType::AudioBook:
                return "/audiodefault.svg";
            default:
                return "/viewstream.svg";
        }
    }

    $json = json_decode($json);
    $poster_path = '';
    if (isset($json->poster_path) && $json->poster_path)
    {
        $poster_path = $json->poster_path;
    }
    else
    {
        // We got a valid response, but there's no poster. Give up hope
        // of finding a poster and set it to the default image
        switch ($type)
        {
            case RequestType::Movie:
                $poster_path = "/moviedefault.svg";
                break;
            case RequestType::TVShow:
                $poster_path = "/tvdefault.svg";
                break;
            default:
                $poster_path = "/viewstream.svg";
                break;
        }
    }

    $query = "UPDATE user_requests SET poster_path='$poster_path' WHERE id=$request_id";
    $inner_res = $db->query($query);
    if ($inner_res === FALSE)
    {
        return db_error();
    }

    return $poster_path;
}

/// <summary>
/// Get the number of new activities since the user last visited the activity page
/// </summary>
function get_new_activity_count()
{
    global $db;

    $current_user = $_SESSION['id'];
    $query = "SELECT `last_viewed` FROM `activity_status` WHERE `user_id`=$current_user";
    $active_result = $db->query($query);
    $last_active = new DateTime('1970-01-01 00:00:00');
    if ($active_result->num_rows != 0)
    {
        $last_active = new DateTime($active_result->fetch_row()[0]);
    }

    $active_string = $last_active->format('Y-m-d H:i:s');
    $query = "SELECT `type`, `user_id`, `admin_id`, `request_id`, `data`, `timestamp` FROM `activities` WHERE `timestamp` > '$active_string' ";

    if (!UserLevel::is_admin())
    {
        $query .= "AND `user_id`=$current_user ";
    }

    $query .= "ORDER BY `timestamp` DESC";

    $result = $db->query($query);
    if ($result === FALSE)
    {
        return db_error();
    }

    return "{\"new\" : $result->num_rows}";
}

/// <summary>
/// Get all relevant activities for the current user. If the current user is an admin, return
/// all activities, otherwise return activities that directly relate to the current user.
/// </summary>
function get_activities($num, $page, $search, $filter)
{
    global $db;

    $offset = $num == 0 ? 0 : $num * $page;
    $current_user = $_SESSION['id'];
    $filter = json_decode($filter);
    $query = "SELECT `type`, `user_id`, `admin_id`, `request_id`, `data`, `timestamp`, `request_name`, `external_id`, `poster_path` FROM `activities` ";

    $filter_string = "INNER JOIN `user_requests` ON `activities`.`request_id`=`user_requests`.`id` ";

    if (!UserLevel::is_admin())
    {
        $filter_string .= "WHERE `user_id`=$current_user ";
        if (!$filter->type->mine)
        {
            $filter_string .= "AND `admin_id` != 0 ";
        }
    }
    else
    {
        $filter_string .= " WHERE 1 ";
        if (!$filter->type->mine)
        {
            $filter_string .= "AND `admin_id` != $current_user AND `user_id` != $current_user ";
        }
        
        if ($filter->user != -1)
        {
            $filter_string .= "AND `user_id` = $filter->user ";
        }
    }

    if (!$filter->type->new)
    {
        $filter_string .= "AND `type` != 1 ";
    }

    if (!$filter->type->comment)
    {
        $filter_string .= "AND `type` != 2 ";
    }

    if (!$filter->type->status)
    {
        $filter_string .= "AND `type` != 3 ";
    }

    if (strlen($search) > 0)
    {
        $search = $db->real_escape_string($search);
        $filter_string .= "AND `request_name` LIKE '%$search%' ";
    }

    $query .= $filter_string;

    $query .= "ORDER BY `timestamp` " . $filter->order . " ";

    if ($num != 0)
    {
        $query .= "LIMIT $num ";
    }

    if ($offset != 0)
    {
        $query .= "OFFSET $offset";
    }

    $result = $db->query($query);
    if ($result === FALSE)
    {
        return db_error();
    }

    $query = "SELECT `last_viewed` FROM `activity_status` WHERE `user_id`=$current_user";
    $active_result = $db->query($query);
    $last_active = new DateTime('1970-01-01 00:00:00');
    if ($active_result->num_rows != 0)
    {
        $last_active = new DateTime($active_result->fetch_row()[0]);
    }

    // SELECT `type`, `user_id`, `admin_id`, `request_id`, `data`, `timestamp`, `request_name`, `poster_path`, `users`.`id` AS `uid`, `username` FROM `activities` INNER JOIN `user_requests` ON `activities`.`request_id`=`user_requests`.`id` INNER JOIN `users` ON `activities`.`user_id`=`users`.`id` WHERE `request_name` LIKE '%ANA%'

    $activities = new \stdClass();
    $activities->activities = array();
    $activities->new = 0;
    $activities->count = $result->num_rows;
    while ($row = $result->fetch_assoc())
    {
        $ts = new DateTime($row['timestamp']);
        if ($ts->getTimestamp() - $last_active->getTimestamp() > 0)
        {
            $activities->new++;
        }

        $activity = new \stdClass();
        $activity->type = $row['type'];
        $activity->timestamp = $row['timestamp'];
        $activity->username = $_SESSION['username'];
        $activity->uid = $row['user_id'];
        $activity->rid = $row['request_id'];
        $activity->eid = $row['external_id'];
        $activity->value = $row['request_name'];
        $activity->poster = $row['poster_path'];
        if (!$activity->poster)
        {
            $activity->poster = get_poster_path($activity->type, $activity->eid, $activity->rid);
        }

        $admin_id = $row['admin_id'];
        $inner_query = "";
        if ($admin_id == 0)
        {
            $inner_query = "SELECT id, username FROM users WHERE id=$activity->uid";
        }
        else
        {
            $inner_query = "SELECT id, username FROM users WHERE id=$admin_id";
        }

        $inner_result = $db->query($inner_query);
        if ($inner_result === FALSE)
        {
            return db_error();
        }

        if ($inner_result->num_rows == 0)
        {
            return json_error("Unable to get username from activity user id $admin_id");
        }

        $inner_row = $inner_result->fetch_assoc();
        $activity->username = $inner_row['username'];
        $activity->uid = $inner_row['id'];
        $inner_result->close();

        if ($row['type'] == 3) // Status change
        {
            $statuses = array("Pending", "Complete", "Denied", "In Progress", "Waiting");
            $data = json_decode($row['data']);
            if ($data->status >= count($statuses))
            {
                $activity->status = "Unknown";
            }
            else
            {
                $activity->status = $statuses[$data->status];
            }
        }

        array_push($activities->activities, $activity);
    }

    $query = "SELECT COUNT(*) FROM activities " . $filter_string;

    $result = $db->query($query);
    if (!$result)
    {
        return db_error();
    }

    $activities->total = (int)$result->fetch_row()[0];

    // Assume if we're processing this request, the user is viewing the activity page and we should
    // update their last seen time. Can't update right when we visit the page, because it will appear
    // that we never have new activities.
    update_last_seen();
    return json_encode($activities);
}

/// <summary>
/// Update the 'last seen' activities time so we can correctly show the number of new activities for a user
/// </summary>
function update_last_seen()
{
    global $db;
    $uid = $_SESSION['id'];
    $query = "INSERT INTO `activity_status`
        (`user_id`, `last_viewed`) VALUES ($uid, NOW())
        ON DUPLICATE KEY UPDATE `last_viewed`=NOW()";
    $result = $db->query($query);
    if ($result === FALSE)
    {
        error_and_exit(500, db_error());
    }
}

/// <summary>
/// Adds a create activity to the activity table
/// </summary>
function add_create_activity($rid, $uid)
{
    global $db;
    $query = "INSERT INTO `activities` (`type`, `user_id`, `request_id`, `data`) VALUES (1, $uid, $rid, '{}')";
    return $db->query($query) !== FALSE;
}

/// <summary>
/// Add a comment activity to the activity table
/// </summary>
function add_comment_activity($cid, $rid, $ruid, $uid)
{
    global $db;
    $admin_id = ($ruid == $uid ? 0 : $uid);
    $data = "{\"comment_id\" : $cid}";
    $query = "INSERT INTO `activities` (`type`, `user_id`, `admin_id`, `request_id`, `data`) VALUES (2, $ruid, $admin_id, $rid, '$data')";
    return $db->query($query) !== FALSE;
}

/// <summary>
/// Query TheMovieDatabase and return the raw result
/// </summary>
function run_query($endpoint)
{
    $query = TMDB_URL . $endpoint . TMDB_TOKEN;
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $query);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

    $return = curl_exec($ch);
    curl_close($ch);
    return $return;
}

/// <summary>
/// Logs a javascript error to the database
/// </summary>
function log_error($error, $stack)
{
    global $db;
    $query = "INSERT INTO `js_errors` (`error`, `stack`) VALUES ('$error', '$stack')";
    $result = $db->query($query);
    if ($result)
    {
        return json_success();
    }

    return db_error();
}

/// <summary>
/// Sets up a reset token for the given user
/// </summary>
function forgot_password($username)
{
    global $db;
    $user_normalized = $db->real_escape_string(strtolower($username));
    $query = "SELECT id FROM users WHERE `username_normalized`='$user_normalized'";
    $result = $db->query($query);
    if (!$result || $result->num_rows === 0)
    {
        return '{ "Method" : -1 }';
    }

    $id = (int)$result->fetch_row()[0];
    $result->close();

    $query = "SELECT `used`, CONVERT_TZ(timestamp, @@session.time_zone, '+00:00') AS `utc_timestamp` FROM `password_reset` WHERE user_id=$id ORDER BY `timestamp` DESC";
    $result = $db->query($query);
    if ($result && $result->num_rows > 0)
    {
        $row = $result->fetch_assoc();
        $diff = (new DateTime(date("Y-m-d H:i:s")))->getTimestamp() - (new DateTime($row['utc_timestamp']))->getTimestamp();
        if ($diff < 5 * 60)
        {
            return '{ "Method" : 3 }';
        }

        if ($diff < 20 * 60 && (int)$row['used'] == 1)
        {
            return '{ "Method" : 3 }';
        }
    }

    $query = "SELECT * FROM user_info WHERE userid=$id";
    $result = $db->query($query);
    if (!$result)
    {
        return '{ "Method" : 0 }';
    }

    $info = $result->fetch_assoc();
    $method = 0;
    $email = "";
    if ((int)$info['phone'] != 0)
    {
        $method = 1;
        $error = FALSE;
        $email = get_phone_email($info['phone'], $info['carrier'], $error);
        if ($error)
        {
            return '{ "Method" : 4 }';
        }
    }
    else if ($info['email'] != NULL)
    {
        $method = 2;
        $email = $info['email'];
    }

    if ($method == 0)
    {
        return '{ "Method" : 0 }';
    }

    $token = bin2hex(random_bytes(10));
    $query = "INSERT INTO `password_reset` (`user_id`, `token`) VALUES ($id, '$token')";
    $result = $db->query($query);
    if (!$result)
    {
        return '{ "Method" : 4 }';
    }

    $domain = SITE_SHORT_DOMAIN;
    $message = "Hello, $username. You recently requested a password reset at $domain. Click the following link to reset your password: https://$domain/reset?token=$token\n\nIf you did not request a password reset, you can ignore this message.";
    send_email_forget($email, $message, "Password Reset");

    return '{ "Method" : ' . $method . ' }';
}

/// <summary>
/// Resets the password for the user identified by the given token, assuming it's valid
/// </summary>
function reset_password($token, $password, $confirm)
{
    global $db;
    if ($password != $confirm)
    {
        return json_error("Passwords don't match!");
    }

    $query = "SELECT `user_id`, `used`, CONVERT_TZ(timestamp, @@session.time_zone, '+00:00') AS `utc_timestamp` FROM `password_reset` WHERE `token`='$token'";

    $result = $db->query($query);
    if (!$result || $result->num_rows != 1)
    {
        return json_error("Invalid token, please go through the reset process again.");
    }

    $row = $result->fetch_assoc();
    $id = $row['user_id'];
    $diff = (new DateTime(date("Y-m-d H:i:s")))->getTimestamp() - (new DateTime($row['utc_timestamp']))->getTimestamp();
    if ($diff < 0 || $diff > 20 * 60)
    {
        return json_error("Token expired");
    }

    if ((int)$row['used'] == 1)
    {
        return json_error("This token has already been used to reset your password.");
    }

    $query = "SELECT `token` FROM `password_reset` WHERE `user_id`=$id ORDER BY `timestamp` DESC";
    $result = $db->query($query);
    if (!$result)
    {
        return json_error("Something went wrong. Please try again later.");
    }

    if ($result->fetch_row()[0] != $token)
    {
        return json_error("This token has been superseded by a newer reset token. Please use the new token or request another reset.");
    }

    $new_pass_hash = password_hash($password, PASSWORD_DEFAULT);
    $query = "UPDATE `users` SET password='$new_pass_hash' WHERE id=$id";
    $result = $db->query($query);
    if (!$result)
    {
        db_error();
    }

    $query = "UPDATE `password_reset` SET `used`=1 WHERE token='$token'";

    return json_success();
}

/// <summary>
/// Allows an administrator to send a reset link for an arbitrary username to
/// an arbitrary email address. Much fewer safeguards as forgot_password
/// </summary>
function forgot_password_admin($username, $email)
{
    if (!UserLevel::is_admin())
    {
        return json_error("You can't do that!");
    }

    global $db;
    $user_normalized = $db->real_escape_string(strtolower($username));
    $query = "SELECT id FROM users WHERE `username_normalized`='$user_normalized'";
    $result = $db->query($query);
    if (!$result || $result->num_rows === 0)
    {
        return json_error("User does not exist!");
    }

    $id = $result->fetch_row()[0];
    $token = bin2hex(random_bytes(10));
    $query = "INSERT INTO `password_reset` (`user_id`, `token`) VALUES ($id, '$token')";
    $result = $db->query($query);
    if (!$result)
    {
        return db_error();
    }

    $domain = SITE_SHORT_DOMAIN;
    $message = "Hello, $username. You recently requested a password reset at $domain. Click the following link to reset your password: https://$domain/reset?token=$token\n\nIf you did not request a password reset, you can ignore this message.";
    send_email_forget($email, $message, "Password Reset");

    return json_success();
}

/// <summary>
/// Returns whether the current user can modify the given comment
/// </summary>
function can_modify_comment($comment_id)
{
    global $db;
    $result = $db->query("SELECT user_id FROM request_comments WHERE id=$comment_id");
    if (!$result || $result->num_rows == 0)
    {
        return FALSE;
    }

    $uid = $_SESSION['id'];
    $cuid = $result->fetch_row()[0];
    if ($cuid != $uid)
    {
        return FALSE;
    }

    return TRUE;
}

/// <summary>
/// Delete the given comment if the current user is the author
/// </summary>
function delete_comment($comment_id)
{
    global $db;

    // First, make sure the user is allowed to delete this comment
    if (!can_modify_comment($comment_id))
    {
        return json_error("You don't have permission to delete that comment!");
    }

    $result = $db->query("DELETE FROM request_comments WHERE id=$comment_id");
    if (!$result)
    {
        return db_error();
    }

    return json_success();
}

/// <summary>
/// Update the given comment with new content
/// </summary>
function edit_comment($comment_id, $content)
{
    global $db;

    if (!can_modify_comment($comment_id))
    {
        return json_error("You don't have permission to edit that comment!");
    }

    $comment = $db->real_escape_string($content);
    $result = $db->query("UPDATE request_comments SET content='$comment' WHERE id=$comment_id");
    if (!$result)
    {
        return json_error("Something went wrong, please try again later");
    }

    return json_success();
}

/// <summary>
/// Refresh the cached poster path for a given request
/// </summary>
function update_poster($rid)
{
    global $db;
    if (!$db->query("UPDATE `user_requests` SET `poster_path`='' WHERE id=$rid"))
    {
        return db_error();
    }

    $result = $db->query("SELECT `request_type`, `external_id` FROM `user_requests` WHERE id=$rid");
    if (!$result)
    {
        return db_error();
    }

    $result = $result->fetch_assoc();

    $request = new \stdClass();
    $request->t = $result["request_type"];
    $request->eid = $result["external_id"];
    $request->rid = $rid;
    $poster = get_poster_path($request->t, $request->eid, $rid);

    $return = new \stdClass();
    $return->rid = $rid;
    $return->poster = $poster;
    return json_encode($return);
}

/// <summary>
/// Checks whether we should show the notification alert
/// after a new request has been made
/// </summary>
function check_notification_alert()
{
    global $db;
    $rid = $_SESSION['id'];
    $query = "SELECT `email`, `email_alerts`, `phone`, `phone_alerts`, `alert_prompt` FROM `user_info` WHERE `userid`=$rid";
    $result = $db->query($query);
    if (!$result || $result->num_rows != 1)
    {
        return db_error();
    }

    $info = $result->fetch_assoc();
    $check = $info['alert_prompt'] != 0 &&
    ($info['email_alerts'] == 0 || strlen($info['email']) == 0) &&
    ($info['phone_alerts'] == 0 || $info['phone'] == 0);

    $check = $check ? '1' : '0';
    return "{ \"should_check\" : $check }";
}

/// <summary>
/// Ensures we won't prompt the user to enable notifications after
/// choosing "Don't ask again" from the notification prompt
/// </summary>
function disable_notification_alert()
{
    global $db;
    $rid = (int)$_SESSION['id'];
    if (!$db->query("UPDATE `user_info` SET `alert_prompt`=0 WHERE userid=$rid"))
    {
        return db_error();
    }

    return json_success();
}

/// <summary>
/// Returns the markdown help text
/// </summary>
function get_markdown_text($type)
{
    if (!$type)
    {
        $textholder = new \stdClass();
        $textholder->data = file_get_contents("includes/mdHelp.md");
        return json_encode($textholder);
    }
    else
    {
        // No other types defined yet
        return json_error("Invalid markdown text type");
    }
}

/// <summary>
/// Get the amount of total and free disk space, in bytes
/// </summary>
function get_available_space()
{
    if (UserLevel::current() < UserLevel::Regular)
    {
        return '{ "total" : 0, "free" : 0}';
    }

    $total = 0;
    $available = 0;
    foreach (BACKING_STORAGE as $disk)
    {
        $total += disk_total_space($disk . ":");
        $available += disk_free_space($disk . ":");
    }

    return "{ \"total\" : $total, \"free\" : $available }";
}

/// <summary>
/// Gets the stats for each section of the Plex library
///
/// Results are cached for four hours, because it's not a cheap operation, and library
/// contents don't change that often
/// </summary>
function get_library_stats($force)
{
    global $db;
    $query = "SELECT id, data, CONVERT_TZ(timestamp, @@session.time_zone, '+00:00') AS `utc_timestamp` FROM `library_stats_cache` ORDER BY id DESC LIMIT 1";
    $result = $db->query($query);
    if (!$result)
    {
        return db_error();
    }

    $json = "";
    if ($result->num_rows == 0)
    {
        return refresh_library_stats();
    }

    $row = $result->fetch_assoc();
    $timestamp = new DateTime($row['utc_timestamp']);
    $now = new DateTime(date("Y-m-d H:i:s"));
    $diff = ($now->getTimestamp() - $timestamp->getTimestamp()) / 60 / 60;
    if ($diff > 4)
    {
        return refresh_library_stats();
    }

    return $row['data'];
}

/// <summary>
/// Refresh our cached library stats by querying the Plex server
/// </summary>
function refresh_library_stats()
{
    global $db;
    $json_sections = array();
    $sections = simplexml_load_string(curl(PLEX_SERVER . '/library/sections?' . PLEX_TOKEN));
    foreach ($sections as $section)
    {
        array_push($json_sections, parse_section($section));
    }

    // Always add a new entry. Not really necessary, but could be nice to see the history of the
    // library over time.
    $data = json_encode($json_sections);
    $db_data = $db->real_escape_string($data);
    $query = "INSERT INTO `library_stats_cache` (`data`) VALUES ('$db_data')";
    if (!$db->query($query))
    {
        return db_error();
    }

    return $data;
}

/// <summary>
/// Parses a single section of a Plex library
/// </summary>
function parse_section($section)
{
    $types = [
        "movie" => 1,
        "show" => 2, "season" => 3, "episode" => 4,
        "trailer" => 5, "comic" => 6, "person" => 7,
        "artist" => 8, "album" => 9, "track" => 10,
        "photoAlbum" => 11, "picture" => 12, "photo" => 13, "clip" => 14, "playlistItem" => 15
    ];

    $json = new \stdClass();
    $json->title = (string)$section['title'];
    process_section_items((int)$section['key'], $types[(string)$section['type']], $json);
    return $json;

}

/// <summary>
/// Processes the items of a given section, doing different operations
/// based on the section type
/// </summary>
function process_section_items($key, $type, &$section)
{
    $type_start = $type;
    $type_end = $type;
    $labels = array("Movies");

    if ($type > 1 && $type < 5)
    {
        // TV shows, 4 indicates number of episodes - get shows, seasons, and episodes
        $type_start = 2;
        $type_end = 4;
        $labels = array("Shows", "Seasons", "Episodes");
    }
    else if ($type > 7 && $type < 11)
    {
        // Music, get artists, albums, and tracks
        $type_start = 8;
        $type_end = 10;
        $labels = array("Artists", "Albums", "Tracks");
    }

    $items = array();
    for ($iType = $type_start; $iType <= $type_end; ++$iType)
    {
        $xml = simplexml_load_string(curl(PLEX_SERVER . '/library/sections/' . $key . '/all?type=' . $iType . '&X-Plex-Container-Start=0&X-Plex-Container-Size=0&' . PLEX_TOKEN));
        $section->{$labels[$iType - $type_start]} = (int)$xml['totalSize'];
        array_push($items, (int)$xml['totalSize']);
    }

    switch ($type)
    {
        case 1:
            addMovieDetails($key, $section);
            break;
        case 2:
            addTvDetails($key, $section);
            break;
        case 8:
            addAudioDetails($key, $section);
            break;
        default:
            break;
    }

    return $items;
}

/// <summary>
/// Adds details about the resolutions of movies in the Plex library
/// </summary>
function addMovieDetails($key, $section)
{
    addSectionDetails(1, $key, "resolution", $section);
}

/// <summary>
///  Adds details about the content rating of tv shows in the Plex library
/// </summary>
function addTvDetails($key, $section)
{
    addSectionDetails(2, $key, "contentRating", $section);
}

/// <summary>
/// Adds details about music sections, in this case how many tracks are from each decade
/// </summary>
function addAudioDetails($key, $section)
{
    $before = PLEX_SERVER . "/library/sections/$key/all?type=10&album.year%3C%3C=1900";
    $append = "&" . PLEX_TOKEN . "&type=10&X-Plex-Container-Start=0&X-Plex-Container-Size=0";
    
    $items = new \stdClass();
    $before_count = (int)simplexml_load_string(curl($before . $append))["totalSize"];
    if ($before_count != 0)
    {
        $dc = "<1900";
        $items->$dc = $before_count;
    }

    $max = (int)date("Y") / 10 * 10;
    $decade = 1900;
    $any = false;
    while ($decade <= $max)
    {
        $decadePath = PLEX_SERVER . "/library/sections/$key/all?type=10&album.decade=$decade" . $append;
        $count = (int)simplexml_load_string(curl($decadePath))["totalSize"];
        if ($count != 0 || $any)
        {
            $any = TRUE;
            $items->$decade = $count;
        }

        $decade += 10;
    }

    $section->decades = $items;
}

/// <summary>
/// Retrieves details for the given section and adds it to the current section
/// </summary>
function addSectionDetails($type, $sectionKey, $detailKey, &$section)
{
    $append = "&type=$type&X-Plex-Container-Start=0&X-Plex-Container-Size=0";
    $base = PLEX_SERVER . "/library/sections/$sectionKey";
    $data = simplexml_load_string(curl($base . "/$detailKey?" . PLEX_TOKEN));
    $items = new \stdClass();
    foreach ($data as $item)
    {
        $path = $base . "/all?type=$type&$detailKey=" . (string)$item["key"] . "&" . PLEX_TOKEN . $append;
        $dict_key = (string)$item["title"];
        $items->$dict_key = (string)simplexml_load_string(curl($path))["totalSize"];
    }

    $section->$detailKey = $items;
}

/// <summary>
/// Sets the internal Plex id for the given request
/// </summary>
function set_internal_id($req_id, $id)
{
    global $db;
    if (!UserLevel::is_admin())
    {
        return json_error("Not Authorized");
    }

    $req = $db->query("SELECT * FROM `user_requests` WHERE `id`=$req_id");
    if (!$req || $req->num_rows == 0)
    {
        return json_error("Invalid Request Id");
    }

    $result = $db->query("UPDATE `user_requests` SET `internal_id`=$id WHERE `id`=$req_id");
    if (!$result)
    {
        return db_error();
    }

    return json_success();
}

/// <summary>
/// Retrieves the internal Plex id for an item along with the server
/// identifier, which combined can create a navigable link
/// </summary>
function get_internal_id($req_id)
{
    global $db;
    if (UserLevel::current() < UserLevel::Regular)
    {
        return json_error("Not Authorized");
    }

    $result = $db->query("SELECT `internal_id` FROM `user_requests` WHERE `id`=$req_id");
    if (!$result || $result->num_rows == 0)
    {
        return !$result ? db_error() : json_error("Invalid Request Id");
    }

    $json = new \stdClass();
    $internal_id = $result->fetch_row()[0];
    if (is_null($internal_id))
    {
        $json->internal_id = -1;
    }
    else
    {
        $json->internal_id = (int)$internal_id;
    }
    
    $json->machine_id = get_plex_server();
    return json_encode($json);
}

/// <summary>
/// Returns the Plex server identifier, or an empty string if the user doesn't have the right permissions
/// </summary>
function get_plex_server()
{
    if (UserLevel::current() < UserLevel::Regular)
    {
        return "";
    }

    $server_info = simplexml_load_string(curl(PLEX_SERVER . '?' . PLEX_TOKEN));
    return (string)$server_info['machineIdentifier'];
}

/// <summary>
/// Gets the IMDb rating for the given title
/// </summary>
function get_imdb_rating($title)
{
    $update = 0;
    $res = refresh_imdb_ratings(FALSE /*force*/);
    if ($res)
    {
        // Hacky. If we don't need to update, we'll return FALSE and not hit this block. However, a
        // successful update will return the time in seconds it took to update, which we want to return
        // to the user. If we hit a failure, we'll be given a JSON string, which will fail floatval
        $update = floatval($res);
        if ($update == 0)
        {
            return $res;
        }
    }

    global $db;
    $titleStripped = (int)substr($title, 2);
    $query = "SELECT `rating` FROM `imdb_ratings` WHERE `imdbid`=$titleStripped";
    $result = $db->query($query);
    if (!$result)
    {
        return db_error();
    }

    if ($result->num_rows !== 1)
    {
        return json_error("Unable to find rating for $title");
    }

    $rating = number_format($result->fetch_row()[0] / 10, 1, '.', '');
    return '{ "rating" : "' . $rating . ($update ? ('", "update" : ' . $update) : '"') . ' }';
}

/// <summary>
/// Checks if we need to update our IMDb ratings database.
/// If $force is true, then we update the database regardless of
/// the last time the database was updated.
/// </summary>
function refresh_imdb_ratings($force)
{
    $file = "includes/title.ratings.tsv";
    $exists = file_exists($file);
    if (!$force && (file_exists($file) || time() - filemtime($file) <= (86400 * 7)))
    {
        return FALSE;
    }

    // This is an expensive operation. Fire and forget so we don't lock up the site
    fire_and_forget("http://127.0.0.1/plex/includes/update_imdb_ratings.php", "");
    return json_success();
}

/// <summary>
/// Handles the case where we were unable to update/add the cached rating.
/// If we don't have a stale cached item, return a failure, otherwise return the cached rating
/// </summary>
function imdb_rating_failure($title, $cached)
{
    if (!$cached)
    {
        return json_error("Could not get IMDb rating for tt$title");
    }

    return '{ "rating" : "' . $cached . '", "err" : "Unable to update stale cache  for tt' . $title . '", "cached" : true }';
}

// By default IMDb ratings will update if it's been over 7 days
// since the last update, but administrators can also force an update
function force_update_imdb_ratings()
{
    if (!UserLevel::is_admin())
    {
        return json_error("Not Authorized");
    }

    $file = "includes/status.json";
    if (file_exists($file) && json_decode(file_get_contents("includes/status.json"))->status != "Success")
    {
        $message = json_decode(file_get_contents($file));
        if (property_exists($message, "status") && $message->status == "In Progress")
        {
            return json_error("Refresh already in progress!");
        }
    }

    $result = refresh_imdb_ratings(TRUE);
    $update_time = floatval($result);
    if ($update_time == 0)
    {
        // An update time of 0 indicates a failure in floatval, which we take
        // as a sign that the update failed and a JSON string was returned
        return $result;
    }

    return "{ \"update_time\" : $update_time }";
}

function get_imdb_update_status()
{
    $file = "includes/status.json";
    if (!file_exists($file))
    {
        return '{ "Status" : "Unknown" }';
    }

    return file_get_contents($file);
}
?>

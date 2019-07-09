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

$type = get('type');

// For requests that are only made when not logged in, don't session_start or verify login state
switch ($type)
{
    case "check_username":
    case "login":
    case "register":
        break;
    default:
        session_start();
        verify_loggedin();
        break;
}

json_message_and_exit(process_request($type));

/// <summary>
/// Our main entrypoint. Returns a json message (on success or failure)
/// </summary>
function process_request($type)
{
    $message = "";
    switch ($type)
    {
        case "login":
            $message = login(get("username"), get("password"));
            break;
        case "register":
            $message = register(get("username"), get("password"), get("confirm"));
            break;
        case "request":
            $message = process_suggestion(get("name"), get("mediatype"), get("comment"));
            break;
        case "pr": // pr === permission_request
            $message = process_permission_request();
            break;
        case "req_update":
            $message = process_request_update(get("kind"), get("content"), get("id"));
            break;
        case "set_usr_info":
            $message = update_user_settings(
                get('fn'),
                get('ln'),
                get('e'),
                get('ea'),
                get('p'),
                get('pa'),
                get('c'));
            break;
        case "get_usr_info":
            $message = get_user_settings();
            break;
        case "check_username":
            $message = check_username(get("username"));
            break;
        case "members":
            $message = get_members();
            break;
        case "search":
            $message = search(get("query"), get("kind"));
            break;
        case "search_external":
            $message = search_external(get("query"), get("kind"));
            break;
        case "update_pass":
            $message = update_password(get("old_pass"), get("new_pass"), get("conf_pass"));
            break;
        case "geoip":
            $message = get_geo_ip(get("ip"));
            break;
        default:
            return json_error("Unknown request type: " . $type);
    }

    return $message;
}

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
    $_SESSION['level'] = $level;

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

    $text_msg = "New user registered on plexweb!\r\n\r\nUsername: " . $username . "\r\nIP: " . $_SERVER["REMOTE_ADDR"];
    send_email_forget(ADMIN_PHONE, $text_msg, "" /*subject*/);
    return json_success();
}

/// <summary>
/// Processes the given suggestion and alerts admins as necessary
/// </summary>
function process_suggestion($suggestion, $type, $comment)
{
    $type = RequestType::get_type_from_str($type);
    if (strlen($suggestion) > 64)
    {
        return json_error("Suggestion must be less than 64 characters");
    }

    if (strlen($comment) > 1024)
    {
        return json_error("Comment must be less than 1024 characters");
    }

    if ($type === RequestType::None)
    {
        return json_error("Unknown media type: " . $_POST['mediatype']);
    }

    global $db;
    $suggestion = $db->real_escape_string($suggestion);
    $comment = $db->real_escape_string($comment);
    $userid = (int)$_SESSION['id'];
    $query = "INSERT INTO user_requests (username_id, request_type, request_name, comment) VALUES ($userid, $type, '$suggestion', '$comment')";
    if (!$db->query($query))
    {
        return json_error($db->error);
    }

    return json_success();
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
        return json_error("Error querying database");
    }

    if ($result->num_rows == 0)
    {
        $result->close();
        if ($get_only)
        {
            return '{ "value" : "Request Access" }';
        }

        $query = "INSERT INTO user_requests (username_id, request_type, request_name, comment) VALUES ($userid, 10, 'ViewStream', '')";
        $result = $db->query($query);
        if ($result === FALSE)
        {
            return json_error("Error querying database");
        }

        return '{ "value" : "Access Requested!" }';
    }
    else
    {
        $str = "";
        $status = (int)$result->fetch_row()[1];
        $result->close();
        switch($status)
        {
            case 0:
                return '{ "value" : "Request Pending" }';
            case 1:
                return '{ "value" : "Request Approved" }';
            case 2:
                return '{ "value" : "Request Denied" }';
            default:
                return json_error("Unknown request status");
        }
    }
}

/// <summary>
/// Processes a request to update a user request. 'kind', id' and 'content' must be set
/// </summary>
function process_request_update($kind, $content, $id)
{
    $req_id = (int)$id;
    $level = (int)$_SESSION['level'];
    $sesh_id = (int)$_SESSION['id'];
    $requester = get_user_from_request($req_id);
    if ($requester->id === -1)
    {
        // Bad request id passed in
        return json_error("Bad request");
    }

    if ($level < 100 && $requester->id != $sesh_id)
    {
        // Only superadmins can edit all requests
        return json_error("Not authorized");
    }

    switch ($kind)
    {
        case "adm_cm":
            if ($level < 100)
            {
                return json_error("Not authorized");
            }

            return update_admin_comment($req_id, $content, $requester);
        case "usr_cm":
            if ($requester->id != $sesh_id)
            {
                // Only the requester can update the user comment
                return json_error("Not authorized");
            }

            return update_user_comment($req_id, $content);
        case "status":
            if ($level < 100)
            {
                // Only admins can change status
                return json_error("Not authorized");
            }

            return update_req_status($req_id, (int)$content, $requester);
        default:
            return json_error("Unknown request update type: " . $kind);
    }
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
        $emailalerts = !strcmp($emailalerts, "true") ? "TRUE" : "FALSE";
        $phonealerts = !strcmp($phonealerts, "true") ? "TRUE" : "FALSE";
        $phone = strcmp($phonealerts, "FALSE") ? (int)$phone : 0;
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
/// Updates the admin comment for the given request
/// </summary>
function update_admin_comment($req_id, $content, $requester)
{
    global $db;
    $content = $db->real_escape_string($content);
    $query = "SELECT admin_comment, request_name FROM user_requests WHERE id=$req_id";
    $result = $db->query($query);
    if (!$result || $result->num_rows === 0)
    {
        return db_error();
    }

    $row = $result->fetch_row();
    $old_comment = $row[0];
    $req_name = $row[1];
    $result->close();
    if (strcmp($old_comment, $content) === 0)
    {
        // Comments are the same, do nothing
        return json_success();
    }

    $query = "UPDATE user_requests SET admin_comment = '$content' WHERE id=$req_id";
    if (!$db->query($query))
    {
        return db_error();
    }

    // Failure to send notificactions won't be considered a failure
    send_notifications_if_needed("comment", $requester, $req_name, $content);
    return json_success();
}

/// <summary>
/// Updates the user comment of the given request
/// </summary>
/// <todo>Send notifications to admins on update</todo>
function update_user_comment($req_id, $content)
{
    global $db;
    $content = $db->real_escape_string($content);
    $query = "UPDATE user_requests SET comment = '$content' WHERE id=$req_id";
    if (!$db->query($query))
    {
        return db_error();
    }

    return json_success();
}

/// <summary>
/// Updates the status of the given request
/// </summary>
function update_req_status($req_id, $status, $requester)
{
    global $db;
    $request_query = "SELECT * FROM user_requests WHERE id=$req_id";
    $result = $db->query($request_query);
    if (!$result)
    {
        return db_error();
    }

    $row = $result->fetch_row();
    $result->close();
    $request_type = RequestType::get_type($row[2]);
    $req_name = RequestType::get_str($request_type) . " " . $row[3];
    if ($request_type == RequestType::StreamAccess)
    {
        // Need to adjust permissions
        $update_level = "";
        if ($status == 1 && $requester->level < 20)
        {
            $update_level = "UPDATE users SET level=20 WHERE id=$requester->id";
            if (!$db->query($update_level))
            {
                return db_error();
            }
        }
        else if ($status == 2 && $requester->level >= 20)
        {
            // Access revoked. Bring them down a peg
            $update_level = "UPDATE users SET level=10 WHERE id=$requester->id";
        }

        if (!empty($update_level) && !$db->query($update_level))
        {
            return db_error();
        }
    }

    // Update the actual request
    $query = "UPDATE user_requests SET satisfied=$status WHERE id=$req_id";
    if (!$db->query($query))
    {
        return db_error();
    }

    $status_str = ($status == 0 ? "pending" : ($status == 1 ? "approved" : "denied"));
    send_notifications_if_needed("status", $requester, $req_name, $status_str);
    return json_success();
}

/// <summary>
/// Send email and text notifications if the user has requested them
/// </summary>
function send_notifications_if_needed($type, $requester, $req_name, $content)
{
    $text = "";
    switch ($type)
    {
        case "comment":
            $text = "A comment has been added to your request for " . $req_name . ": " . $content;
            break;
        case "status":
            $text = "The status of your request has changed:\nRequest: " . $req_name . "\nStatus: " . $content;
            break;
        default:
            return json_error("Unknown notification type: " . $type);
    }

    if ($requester->info->phone_alerts && $requester->info->phone != 0)
    {
        $to = "";
        $phone = $requester->info->phone;
        switch ($requester->info->carrier)
        {
            case "verizon":
                $to = $phone . "@vtext.com";
                break;
            case "tmobile":
                $to = $phone . "@tmomail.net";
                break;
            case "att":
                $to = $phone . "@txt.att.net";
                break;
            case "sprint":
                $to = $phone . "@messaging.sprintpcs.com";
                break;
            default:
                return json_error("Unknown carrier: " . $requester->info->carrier);
        }

        $subject = "";
        send_email_forget($to, $text, $subject);
    }

    if ($requester->info->email_alerts && !empty($requester->info->email))
    {
        $subject = "Plex Request Update";
        send_email_forget($requester->info->email, $text, $subject);
    }

    return json_success();
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
/// Returns a json string of members, sorted by the last time they logged in
/// </summary>
function get_members()
{
    if ((int)$_SESSION['level'] < 100)
    {
        return json_error("Not authorized");
    }

    global $db;
    $query = "SELECT id, username, level, last_login FROM users ORDER BY id ASC";
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
        $user->level = $row[2];
        $user->last_seen = $row[3];
        array_push($users, $user);
    }

    $result->close();

    return json_encode($users);
}

/// <summary>
/// Perform a search against the plex server
/// </summary>
function search($query, $kind)
{
    if ((int)$_SESSION['level'] < 20)
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
        $item->thumb = 'thumb' . $result['thumb'];
        $item->year = (string)$result['year'];
        if (RequestType::is_audio($type))
        {
            // Todo - search Audible/music apis?
        }
        else
        {
            $copies = $result->xpath('Media');
            $res = "";
            foreach ($copies as $file)
            {
                $newRes = $file['videoResolution'];
                if ($newRes)
                {
                    $res .= $newRes . ", ";
                }
            }

            $len = strlen($res);
            if ($len > 0)
            {
                $res = substr($res, 0, $len - 2);
                $item->resolution = $res;
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
/// Search for a movie or tv show via IMDb.
/// </summary>
function search_external($query, $kind)
{
    $query = strtolower(trim($query));
    $letter = substr($query, 0, 1);
    $type = strtolower(RequestType::get_type_from_str($kind));

    if ($type != RequestType::Movie && $type != RequestType::TVShow)
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://www.audible.com/search?keywords=" . $query);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $text = curl_exec($ch);
        curl_close($ch);
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
/// Get the contents of the given url
/// </summary>
function curl($url)
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $return = curl_exec($ch);
    curl_close($ch);
    return $return;
}
?>

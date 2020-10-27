<?php
session_start();
require_once "includes/config.php";
require_once "includes/common.php";

requireSSL();
$req_id = (int)param_or_die("id");
verify_loggedin(TRUE /*redirect*/, "request.php?id=" . $req_id);

$details = get_details($req_id);

if (!UserLevel::is_admin() && !$details->is_author)
{
    error_and_exit(403, "You don't have access to this request!<br><br><a href='requests.php'>Take me back!</a>");
}

/// <summary>
/// Get the relevant details for the given request, which will be inserted into
/// the document via body attributes
/// </summary>
function get_details($req_id)
{
    global $db;
    $query = "SELECT username_id, external_id, request_type, request_name, satisfied FROM user_requests WHERE id=$req_id";
    $result = $db->query($query);
    if ($result === FALSE)
    {
        error_and_exit(500);
    }

    if ($result->num_rows == 0)
    {
        error_and_exit(400, "Invalid request");
    }

    $row = $result->fetch_row();
    $details = new \stdClass();
    $details->is_author = $row[0] == $_SESSION['id'];
    $details->external_id = $row[1];
    $details->request_type = RequestType::get_type($row[2]);
    $details->request_name = $row[3];
    $details->status = $row[4];
    $details->is_media_request = RequestType::is_media_request($details->request_type);

    return $details;
}

?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Plex Request</title>
    <?php build_css(); ?>
</head>
<body
    isAdmin="<?= (UserLevel::is_admin()) ? 1 : 0 ?>"
    isMediaRequest="<?php echo ($details->is_media_request ? 1 : 0)?>"
    reqId="<?= $req_id ?>"
    requestType="<?= $details->request_type ?>"
    requestTypeStr="<?php echo strtolower(RequestType::get_str($details->request_type)) ?>"
    requestName="<?= $details->request_name ?>"
    requestStatus="<?= $details->status ?>"
    externalId="<?= $details->external_id?>"
    newrequest="<?php echo try_get('new') ?>"
    plex_host="<?= PUBLIC_PLEX_HOST ?>"
    plex_nav="<?= PUBLIC_PLEX_NAV ?>">
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <?php if (!$details->is_media_request || $details->external_id) { ?>
            <div id="loadingInfo"><img src='<?php icon("loading") ?>' alt="Loading" width="15%"></div>
            <div id="infoContainer"></div>
            <div id="commentsHolder">
                <div style="margin-bottom: 10px" class="commentHeader">Comments:</div>
                <div id="comments">
                    
                </div>
                <div id="newCommentHolder">
                    <textarea id="newComment" placeholder="Add comment..." class="commentEditor"></textarea>
                </div>
                <div id="mdHolder" style="display: none">
                    <div id="mdHeader" class="commentInfo">Comment Preview:</div>
                    <div id="mdPreview" class="md"></div>
                </div>
                <input type="button" id="newCommentButton" value="Add Comment" style="float: left; clear: both; margin-top: 5px; padding: 10px" />
            </div>
        <?php } else { ?>
            <div class="formContainer" id="info">
                <div class="formTitle">The request for <?= $details->request_name ?> was made with an older version of this website. Please choose the correct item below</div>
                <form id="searchForm" style="overflow: auto">
                    <hr />
                    <div style="margin-bottom: 10px">Potential Matches</div>
                    <div id="matchContainer">Searching...</div>
                    <hr />
                    <div style="text-align: center">---- OR ----</div>
                    <hr />
                    <div class='formInput'><label for='external_id'>IMDb ID:</label><input type=text style="float: left; margin-left: 10px" id='external_id' placeholder='tt1234567'></div>
                    <div id="imdbResult"></div>
                </form>
            </div>
        <?php } ?>
    </div>
</body>
<?php build_js(
    "request",
    "consolelog",
    "animate",
    "common",
    "queryStatus",
    "nav",
    "overlay",
    "DateUtil",
    "markdown",
    "markdownHelp",
    "markdownEditor",
    "tooltip",
    "iconMap"); ?>
</html>

<?php
session_start();
require_once "includes/config.php";
require_once "includes/common.php";

requireSSL();
$req_id = (int)param_or_die("id");
verify_loggedin(TRUE /*redirect*/, "request.php?id=" . $req_id);

$details = get_details($req_id);

if ($_SESSION['level'] != 100 && !$details->is_author)
{
    error_and_exit(403, "You don't have access to this request!<br><br><a href='requests.php'>Take me back!</a>");
}

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
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Plex Request</title>
    <?php get_css("style", "nav", "overlay", "markdown", "tooltip", "request"); ?>
</head>
<body
    isAdmin="<?= (isset($_SESSION['level']) && $_SESSION['level'] >= 100) ? 1 : 0 ?>"
    isMediaRequest="<?php echo ($details->is_media_request ? 1 : 0)?>"
    reqId="<?= $req_id ?>"
    requestType="<?= $details->request_type ?>"
    requestTypeStr="<?php echo ($details->request_type == 1 ? "movie" : "tv") ?>"
    requestName="<?= $details->request_name ?>"
    requestStatus="<?= $details->status ?>"
    externalId="<?= $details->external_id?>">
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <?php if (!$details->is_media_request || $details->external_id) { ?>
            <div id="infoContainer">Getting info...</div>
            <div id="commentsHolder">
                <div style="margin-bottom: 10px" class="commentHeader">Comments:</div>
                <div id="comments">
                    
                </div>
                <div id="mdHelper">
                    <input type="button" class="mdButton" id="addBold" value="B" title="Bold" style="border-left: none" />
                    <input type="button" class="mdButton" id="addUnderline" value="U" title="Underline" />
                    <input type="button" class="mdButton" id="addItalic" value="I" title="Italic" />
                    <input type="button" class="mdButton" id="addStrikethrough" value="S" title="Strikethrough" />
                    <button class="mdButton" id="addLink" title="Insert Link"><img src="icon/mdLink.png" altText="Insert Link" /></button>
                    <button class="mdButton" id="addImage" title="Insert Image"><img src="icon/mdImage.png" altText="Insert Image" /></button>
                    <input type="button" class="mdButton" id="showMdHelp" value="?" title="Help" />
                </div>
                <textarea id="newComment" placeholder="Add comment..."></textarea>
                <div id="mdCallout">(Comments now support <a id="mdhelp" href="#">Markdown</a>)</div>
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
<?php build_js("request", "consolelog", "animate", "common", "queryStatus", "nav", "overlay", "DateUtil", "markdown", "tooltip"); ?>
</html>

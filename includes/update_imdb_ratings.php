<?php
/// <summary>
/// Updates IMDb ratings. Pulls down the latest data from IMDb, parses it, and replaces
/// our cached table with the data
/// </summary>
/// <remarks>
/// There's little/no protection here, as we're relying on httpd.conf blocking this file
/// to anything but local connections, forcing this to only be called in (hopefully) valid
/// server-side scenarios.
/// </remarks>

require_once "common.php";
require_once "config.php";
requireSSL();

function update_status($status, $message)
{
    $json = new \stdClass();
    $json->status = $status;
    $json->message = $message;
    write_status(json_encode($json));
}

function write_status($status)
{
    file_put_contents("status.json", $status);
}

// Using a text file is a horrible way to go about this, but it works
update_status("In Progress", "Downloading content");
$file = "title.ratings.tsv";
$url = "https://datasets.imdbws.com/title.ratings.tsv.gz";
$result = curl($url, Array(
    CURLOPT_HEADER => 0,
    CURLOPT_TIMEOUT => 60 // This is under 6MB, so it better not take more than a minute!
));

if ($result[0] == '{')
{
    // This smells like a curl error
    update_status("Failed", "Unable to get data from IMDb");
    die();
}

$data = gzdecode($result);

// Writing to an output file isn't really necessary, but it makes checking
// the last modified date easier.
$output = fopen($file, "w");
if (fwrite($output, $data) === FALSE)
{
    update_status("Failed", "Unable to write to tsv file");
    fclose($output);
    die();
}

fclose($output);

global $db;

$rows = explode("\n", $data);
$start = microtime(TRUE);

// Autocommit kills the speed of this operation (by about 15x). Even with autocommit off this takes ~100 seconds
if (!$db->autocommit(FALSE))
{
    update_status("Failed", "Could not turn off autocommit: $db->error");
    die();
}

// Better to just clear it out and re-fill. 'ON DUPLICATE KEY UPDATE' is a possibility, but this is
// likely more performant when dealing with 1M+ rows that are mostly duplicates.
if (!$db->query("TRUNCATE TABLE `imdb_ratings`"))
{
    update_status("Failed", "Could not clear ratings table: $db->error");
    die();
}

$total = count($rows);
for ($i = 1; $i < $total; ++$i) // First row is headers
{
    $row = $rows[$i];
    $entry = explode("\t", $row);
    $id = (int)substr($entry[0], 2);
    $rating = (int)((double)($entry[1]) * 10);
    $votes = (int)$entry[2];

    $query = "INSERT INTO `imdb_ratings` (`imdbid`, `rating`, `votes`) VALUES ($id, $rating, $votes)";
    
    if (!$db->query($query))
    {
        update_status("Failed", "Could not update row for " . $entry[0] . ": $db->error");
        die();
    }

    if ($i % 50000 == 0)
    {
        $percent = round(($i * 100) / $total, 2);
        $time = round(microtime(TRUE) - $start, 2);
        update_status("In Progress", "Processed $i of $total records (" . $percent . "%) in " . $time . " seconds");
    }
}

if (!$db->commit() || !$db->autocommit(TRUE))
{
    update_status("Failed", "Could not commit changes: $db->error");
    die();
}

update_status("Success", date(DateTimeInterface::ISO8601) . " - Completed $total records in " . round(microtime(TRUE) - $start, 2) . " seconds");
?>

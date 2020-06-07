<?php
require_once "common.php";
require_once "config.php";
requireSSL();
$to = param_or_die('to');
$content = param_or_die('content');
$subject = param_or_die('subject');

require "phpMail/Exception.php";
require "phpMail/OAuth.php";
require "phpMail/PHPMailer.php";
require "phpMail/POP3.php";
require "phpMail/SMTP.php";

use PHPMailer\PHPMailer\PHPMailer;
$mail = new PHPMailer();
$mail->IsSMTP();                // Sets up a SMTP connection
$mail->SMTPAuth = true;
$mail->SMTPSecure = "tls";
$mail->Host = MAIL_HOST;
$mail->Port = 587;
$mail->Encoding = "base64";

$mail->Username = MAIL_USER;
$mail->Password = MAIL_PASS;

if (MAIL_ALIAS != MAIL_USER)
{
    $mail->setFrom(MAIL_ALIAS, "Plex Requests");
}

$mail->Subject = html_entity_decode($subject);
$mail->msgHTML(html_entity_decode($content));

$mail->AddAddress(html_entity_decode($to));
$textSuccess = $mail->send();
?>

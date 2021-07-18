/// <summary>
/// Base Filter class for filters that include a filter-by-user option.
/// </summary>

/* exported UserFilter */

class UserFilter extends Filter
{
    /// <summary>
    /// Get a list of all the users to populate the admin-only filter option
    /// </summary>
    populateUserFilter()
    {
        let params = { type : ProcessRequest.GetAllMembers };
        let successFunc = function(response)
        {
            let select = $("#filterTo");
            response.forEach(function(user)
            {
                select.appendChild(buildNode("option", { value : user.id }, user.username));
            });

            select.value = this.get().user;
        }.bind(this);

        let failureFunc = function()
        {
            Animation.queue({ backgroundColor : "rgb(100, 66, 69)" }, $("#filterTo"), 500);
            Animation.queueDelayed({ backgroundColor : "rgb(63, 66, 69)" }, $("#filterTo"), 1000, 500, true);
        };

        sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
    }
}

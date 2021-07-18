/// <summary>
/// Filter definition for the Members table
/// </summary>

/* exported MemberFilter */

/* eslint-disable class-methods-use-this */

class MemberFilter extends Filter
{
    html()
    {
        let options = [];

        let checkboxes =
        {
            "New Members" : "showNew",
            Regulars : "showRegular",
            Admins : "showAdmin"
        };

        for (let [label, name] of Object.entries(checkboxes))
        {
            options.push(FilterUIBuilder.buildCheckbox(label, name));
        }

        options.push(buildNode("hr"));

        options.push(FilterUIBuilder.buildDropdown(
            "Has PII",
            {
                All : "all",
                Yes : "yes",
                No : "no"
            }));
        options.push(buildNode("hr"));

        options.push(FilterUIBuilder.buildDropdown(
            "Sort By",
            {
                "Account Age" : "id",
                Name : "name",
                "Last Login" : "seen",
                Level : "level",
            }));

        options.push(FilterUIBuilder.buildDropdown(
            "Sort Order",
            {
                "Newest First" : "sortDesc",
                "Oldest First" : "sortAsc"
            },
            true /*addId*/));
        options.push(buildNode("hr"));

        return this.htmlCommon(options);
    }

    populate()
    {
        let filter = this.get();
        $("#showNew").checked = filter.type.new;
        $("#showRegular").checked = filter.type.regular;
        $("#showAdmin").checked = filter.type.admin;
        $("#hasPII").value = filter.pii;
        $("#sortBy").value = filter.sort;
        $("#sortOrder").value = filter.order == "desc" ? "sortDesc" : "sortAsc";

        this._setSortOrderValues();
        $("#sortBy").addEventListener("change", this._setSortOrderValues);
    }

    get()
    {
        let filter = null;
        try
        {
            filter = JSON.parse(localStorage.getItem(this.table.idCore() + "_filter"));
        }
        catch (e)
        {
            Log.error("Unable to parse stored filter, resetting");
        }

        const hasProp = (item, property) => Object.prototype.hasOwnProperty.call(item, property);
        if (filter === null ||
            !hasProp(filter, "type") ||
                !hasProp(filter.type, "new") ||
                !hasProp(filter.type, "regular") ||
                !hasProp(filter.type, "admin") ||
            !hasProp(filter, "pii") ||
            !hasProp(filter, "sort") ||
            !hasProp(filter, "order"))
        {
            if (filter !== null)
            {
                Log.error(filter, "Bad filter, resetting");
            }

            filter = this.default();
            this.set(filter, false /*update*/);
        }

        Log.verbose(filter, "Got Filter");
        return filter;
    }

    default()
    {
        return {
            type :
            {
                new : true,
                regular : true,
                admin : true
            },
            pii : "all",
            sort : "id",
            order : "asc"
        };
    }

    getFromDialog()
    {
        return {
            type :
            {
                new : $("#showNew").checked,
                regular : $("#showRegular").checked,
                admin : $("#showAdmin").checked
            },
            pii : $("#hasPII").value,
            sort : $("#sortBy").value,
            order : $("#sortOrder").value == "sortDesc" ? "desc" : "asc"
        };
    }

    /// <summary>
    /// Handler that modifies the sort order strings based on the sort criteria
    /// </summary>
    _setSortOrderValues()
    {
        let sortBy = $("#sortBy").value;
        if (sortBy == "level")
        {
            $("#sortDesc").text = "Highest to Lowest";
            $("#sortAsc").text = "Lowest to Highest";
        }
        else if (sortBy == "name")
        {
            $("#sortDesc").text = "A-Z";
            $("#sortAsc").text = "Z-A";
        }
        else if (sortBy == "seen")
        {
            $("#sortDesc").text = "Descending";
            $("#sortAsc").text = "Ascending";
        }
        else
        {
            $("#sortDesc").text = "Newest First";
            $("#sortAsc").text = "Oldest First";
        }
    }
}

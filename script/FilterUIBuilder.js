/// <summary>
/// Helper class for building various filter UI elements
/// </summary>

/* exported FilterUIBuilder */

/*eslint-disable class-methods-use-this */

class FilterUIBuilder
{
    static buildCheckbox(label, name)
    {
        if (name == "")
        {
            return buildNode("hr");
        }

        let div = buildNode(
            "div",
            { class : "formInput" },
            0,
            {
                click : function(e)
                {
                    // If we clicked the filter item but not directly on the label.checkbox, pretend we did
                    if (e.target == this)
                    {
                        this.$$("input").click();
                    }
                }
            }
        );

        return div.appendChildren(
            buildNode("label", { for : name }, label + ": "),
            buildNode(
                "input",
                {
                    type : "checkbox",
                    name : name,
                    id : name
                }
            )
        );
    }

    static buildDropdown(title, options, addId=false)
    {
        // Make the name the camelCase version of the title
        let name = title.split(" ");
        name = name.splice(0, 1)[0].toLowerCase() + name.join("");
        let container = buildNode("div", { class : "formInput" });
        container.appendChild(buildNode("label", { for : name }, title + ": "));
        let select = buildNode("select", { name : name, id : name });
        for (let [label, value] of Object.entries(options))
        {
            let option = buildNode("option", { value : value }, label);
            if (addId)
            {
                option.id = value;
            }

            select.appendChild(option);
        }

        return container.appendChildren(select);
    }
}

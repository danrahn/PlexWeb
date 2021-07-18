/// <summary>
/// Common table implementation, including interfaces for custom sorting, filtering, and searching.
///
/// Users of this interface should implement the following:
/// 1. identifier() - Returns a string that identifies this table (required)
/// 2. updateFunc() - Returns a function to call when updating the table (required)
/// 3. supportsSearch() - Returns whether searching the table is supported (optional, default=false)
/// </summary>

/* exported Table, Filter */

/*eslint-disable class-methods-use-this */

class Table
{
    constructor(tableFilter=null)
    {

        window.addEventListener("load", function()
        {
            Log.error("Table constructed before DOM was loaded. This shouldn't happen!");
        });

        /// <summary>Total number of pages in the table</summary>
        this.tablePages = 0;

        /// <summary>Custom filter options that can be applied to this table</summary>
        this.filter = tableFilter;
        this.filter.setTable(this);

        /// <summary>List of current DOM table entries</summary>
        this.tableEntries = $("#tableEntries");

        this.setupPerPage();
        this.setupNavigation();
        this.setupTableSearch();
        this.setupFilter();
        this.setupKeyboardNavigation();
        this.setupDirectPageNavigation();
    }

    /// <summary>
    /// Clear out the current contents of the request table and replace it
    /// with a single informational message
    /// </summary>
    displayInfoMessage(message)
    {
        this.clear();
        $("#tableEntries").appendChild(buildNode("div", { id : "resultInfo" }, message));
    }

    /// <summary>
    /// Set up click handlers for previous/next buttons
    /// </summary>
    setupNavigation()
    {
        $(".previousPage").forEach(function(e)
        {
            e.addEventListener("click", this.previousPage.bind(this));
        }, this);

        $(".nextPage").forEach(function(e)
        {
            e.addEventListener("click", this.nextPage.bind(this));
        }, this);
    }

    /// <summary>
    /// Set up general keyboard navigation, and the handler for
    /// when the user goes to a specific page via the input dialog
    ///
    /// SHIFT + LEFT_ARROW - Previous Page
    /// SHIFT + RIGHT_ARROW - Next Page
    /// </summary>
    setupKeyboardNavigation()
    {
        document.addEventListener("keyup", function(e)
        {
            // Don't do anything if we're in an input field
            let active = document.activeElement;
            let tag = active.tagName.toLowerCase();
            if (tag == "textarea" || (tag == "input" && active.type.toLowerCase() == "text"))
            {
                return;
            }

            let key = e.keyCode ? e.keyCode : e.which;
            if (e.shiftKey && !e.altKey && !e.ctrlKey)
            {
                switch (key)
                {
                    default:
                        break;
                    case KEY.LEFT:
                        this.previousPage();
                        break;
                    case KEY.RIGHT:
                        this.nextPage();
                        break;
                    case KEY.F:
                        if ($$(".filterBtn"))
                        {
                            $$(".filterBtn").click();
                        }

                        break;
                }
            }
        }.bind(this));
    }

    /// <summary>
    /// Sets up listeners for the direct page select text boxes
    /// </summary>
    setupDirectPageNavigation()
    {
        $(".pageSelect").forEach(function(input)
        {
            input.addEventListener("keyup", function(e)
            {
                let key = e.keyCode ? e.keyCode : e.which;
                let src = e.srcElement;
                if (key == KEY.ENTER)
                {
                    let page = parseInt(src.value);
                    if (isNaN(page) || page <= 0 || page > this.tablePages)
                    {
                        src.value = this.getPage() + 1;
                        src.select();
                        return;
                    }

                    this.setPage(page - 1, true /*update*/);
                    src.select();
                }
            }.bind(this));

            input.addEventListener("focus", function()
            {
                input.select();
            });
        }, this);
    }

    setupFilter()
    {
        if (!this.filter)
        {
            $(".filterBtn").forEach(function(filterBtn)
            {
                filterBtn.style.display = "none";
            });

            return;
        }

        this.filter.setup();
    }

    /// <summary>
    /// Setup listeners for searching the table
    /// </summary>
    setupTableSearch()
    {
        // If the table does not have a search function,
        // don't show anything. Might mess up CSS
        if (!this.supportsSearch())
        {
            $(".searchBtn").forEach(function(btn)
            {
                btn.style.display = "none";
            });

            return;
        }

        $(".searchBtn").forEach(function(btn)
        {
            btn.addEventListener("click", this.searchBtnClick.bind(this));
        }, this);

        $(".searchGo").forEach(function(btn)
        {
            btn.addEventListener("click", this.startTableSearch.bind(this));
        }, this);

        this._setupSearchListeners();
    }

    /// <summary>
    /// Sets up search listeners to commit on enter/cancel on escape
    /// as well as setting up the click handler for the cancel button
    /// </summary>
    _setupSearchListeners()
    {
        $(".searchInput").forEach(function(input)
        {
            input.addEventListener("keydown", function(e)
            {
                if (e.keyCode == KEY.ENTER)
                {
                    this.parentNode.$$(".searchGo").click();
                }
                else if (e.keyCode == KEY.ESC)
                {
                    this.value = "";
                    this.parentNode.parentNode.$$(".searchBtn").click();
                }
            });
        });

        $(".searchInputClear").forEach(function(img)
        {
            img.addEventListener("click", function()
            {
                let search = this.parentNode.$$(".searchInput");
                if (search.value.length != 0)
                {
                    this.parentNode.$$(".searchInput").value = "";
                    this.parentNode.$$(".searchGo").click();
                }

                this.parentNode.parentNode.$$(".searchBtn").click();
            });
        });

        $("#clearSearch").addEventListener("click", function()
        {
            $(".searchInput").forEach(function(input) { input.value = ""; });
            this.update();
        }.bind(this));
    }

    /// <summary>
    /// Listener fired when the search button is clicked
    /// </summary>
    searchBtnClick(event)
    {
        let show = !$$(".pageStatus").style.display || $$(".pageStatus").style.display != "none";
        $(".pageStatus").forEach(function(ele)
        {
            ele.style.display = show ? "none" : "inline-block";
        });

        $(".searchInputHolder").forEach(function(ele)
        {
            ele.style.display = show ? "inline-block" : "none";
        });

        if (show)
        {
            event.srcElement.parentNode.parentNode.$$(".searchInput").focus();
        }
    }

    /// <summary>
    /// Initiates a search. If the owner hasn't defined
    /// a search function, warn the user.
    /// </summary>
    startTableSearch(event)
    {
        try
        {
            this.update(event.srcElement.parentNode.$$(".searchInput").value);
        }
        catch (e)
        {
            Overlay.show("This table doesn't have search enabled (yet)", "OK", Overlay.dismiss);
        }
    }

    /// <summary>
    /// Navigate to the previous page if we're not on the first page
    /// </summary>
    previousPage()
    {
        let page = this.getPage();
        if (page <= 0)
        {
            return;
        }

        this.setPage(page - 1, true);
    }

    /// <summary>
    /// Navigate to the next page if we're not on the last page
    /// </summary>
    nextPage()
    {
        let page = this.getPage();
        if (page == this.tablePages - 1)
        {
            return;
        }

        this.setPage(page + 1, true);
    }

    /// <summary>
    /// Returns the user's current page
    /// </summary>
    getPage()
    {
        let page = parseInt(localStorage.getItem(this.idCore() + "_page"));
        if (page === null || isNaN(page) || page < 0)
        {
            page = 0;
            this.setPage(page);
        }

        return page;
    }

    /// <summary>
    /// Set the number of items to show per page
    /// </summary>
    /// <param name="update">
    /// If true, applies the new perPage setting
    /// False if we aren't ready to change pages yet
    /// </param>
    setPage(page, update)
    {
        localStorage.setItem(this.idCore() + "_page", page);
        if (update)
        {
            this.clear();
            this.update();
        }

        if (page == 0)
        {
            $(".previousPage").forEach(function(button)
            {
                button.classList.add("disabled");
                button.disabled = true;
            });
        }
        else
        {
            $(".previousPage").forEach(function(button)
            {
                button.classList.remove("disabled");
                button.disabled = false;
            });
        }

        if (page == this.tablePages - 1)
        {
            $(".nextPage").forEach(function(button)
            {
                button.classList.add("disabled");
                button.disabled = true;
            });
        }
        else
        {
            $(".nextPage").forEach(function(button)
            {
                button.classList.remove("disabled");
                button.disabled = false;
            });
        }
    }

    /// <summary>
    /// Returns the number of items per page the user wants to see
    /// </summary>
    getPerPage()
    {
        let storage = this.idCore() + "_perPage";
        let perPage = parseInt(localStorage.getItem(storage));
        if (perPage === null || isNaN(perPage) || perPage % 25 != 0 || perPage < 0)
        {
            localStorage.setItem(storage, 25);
            perPage = 25;
        }

        return perPage;
    }

    /// <summary>
    /// Set the number of items to show per page
    /// </summary>
    /// <param name="update">
    /// If true, applies the new perPage setting
    /// False if we aren't ready to query the server for updated items yet
    /// </param>
    setPerPage(newPerPage, update)
    {
        localStorage.setItem(this.idCore() + "_perPage", newPerPage);
        $(".perPageButton").forEach((btn) =>
        {
            btn.classList.remove("selected");
        });

        $(`.perPageButton[value="${newPerPage}"]`).forEach(function(e)
        {
            e.classList.add("selected");
        });

        if (update)
        {
            this.clear();
            this.update();
        }
    }

    /// <summary>
    /// Sets up click handlers for per-page options
    /// </summary>
    setupPerPage()
    {
        if (!this.supportsPages())
        {
            $(".perPageHolder").forEach(function(holder)
            {
                holder.style.display = "none";
            });

            return;
        }

        let perPage = this.getPerPage();
        let self = this;
        $(".perPageButton").forEach((btn) =>
        {
            btn.addEventListener("click", function()
            {
                let newPerPage = parseInt(this.value);
                if (newPerPage === null || isNaN(newPerPage) || newPerPage % 25 != 0 || newPerPage < 0)
                {
                    newPerPage = 25;
                }

                self.setPerPage(newPerPage, true /*update*/);
            });
        });

        this.setPerPage(perPage, false);
    }

    /// <summary>
    /// Update the "Page X of Y" strings in the table
    /// </summary>
    setPageInfo(totalRequests)
    {
        this.tablePages = this.getPerPage() == 0 ? 1 : Math.ceil(totalRequests / this.getPerPage());
        $(".pageSelect").forEach(function(e)
        {
            e.value = this.getPage() + 1;
        }, this);

        $(".pageCount").forEach(function(e)
        {
            e.innerHTML = this.tablePages;
        }, this);

        this.setPage(this.getPage(), false);
    }

    /// <summary>
    /// Invokes the table update callback and sets the search string header visibility
    /// </summary>
    update(searchValue="")
    {
        let header = $("#requestSearch");
        if (searchValue.length == 0)
        {
            header.style.display = "none";
        }
        else
        {
            header.style.display = "block";
            $("#searchTerm").innerHTML = searchValue;
        }

        this.updateFunc()(searchValue);
    }

    /// <summary>
    /// Add the given element to our table
    /// </summary>
    addItem(element)
    {
        this.tableEntries.appendChild(element);
    }

    /// <summary>
    /// Returns the common div that all table items must be within
    /// </summary>
    itemHolder()
    {
        return buildNode("div", { class : "tableEntryHolder" });
    }

    /// <summary>
    /// Remove all entries from the table
    /// </summary>
    clear()
    {
        while (this.tableEntries.firstChild)
        {
            this.tableEntries.removeChild(this.tableEntries.firstChild);
        }
    }

    /// <summary> Return whether this table supports searching </summary>
    supportsSearch() { return false; }

    /// <summary> Returns whether this table supports page navigation </summary>
    supportsPages() { return true; }

    /// <summary> Returns the unique identifier for this table </summary>
    identifier() { return "shared"; }

    /// <summary> Returns the core ID of the table (i.e. the unique identifier prefixed with "table_")
    idCore() { return "table_" + this.identifier(); }
}

window.addEventListener('load', function()
{
    getMembers();
});

function tableIdentifier()
{
    return 'members';
}

function tableUpdateFunc()
{
    return getMembers;
}

function getMembers(searchValue='')
{
    let parameters =
    {
        'type' : 'members',
        'num' : getPerPage(),
        'page' : getPage(),
        'serach' : searchValue,
        'filter' : JSON.stringify(getFilter())
    };

    displayInfoMessage('Loading...');
    let successFunc = function(response)
    {
        buildMembers(response);

        if (searchValue.length != 0)
        {
            $$('.searchBtn').click();
        }
    };

    let failureFunc = function()
    {
        displayInfoMessage('Something went wrong :(');
    };

    sendHtmlJsonRequest('process_request.php', parameters, successFunc, failureFunc);
}

function buildMembers(members)
{
    clearElement('tableEntries');
    if (members.length == 0)
    {
        displayInfoMessage('No members returned. That can\'t be right!');
        return;
    }

    members.forEach(function(member)
    {
        let holder = tableItemHolder();
        holder.appendChild(buildNode('span', { 'class' : 'memberName' }, member.username));
        let list = buildNode('ul');
        list.appendChild(buildNode('li', {}, `ID: ${member.id}`));
        list.appendChild(buildNode('li', {}, `Level: ${member.level}`));

        let lastSeen = buildNode('li', {}, `Last Seen: ${DateUtil.getDisplayDate(member.last_seen)}`);
        setTooltip(lastSeen, DateUtil.getFullDate(member.last_seen));
        list.appendChild(lastSeen);
        holder.appendChild(list);
        addTableItem(holder);
    });
}

function populateFilter()
{
    let filter = getFilter();
    $('#showNew').checked = filter.type.new;
    $('#showRegular').checked = filter.type.regular;
    $('#showAdmin').checked = filter.type.admin;
    $('#sortBy').value = filter.sort;
    $('#sortOrder').value = filter.order == 'desc' ? 'sortDesc' : 'sortAsc';

    setSortOrderValues();
    $('#sortBy').addEventListener('change', setSortOrderValues);
}

function getNewFilter()
{
    return {
        'type' :
        {
            'new' : $('#showNew').checked,
            'regular' : $('#showRegular').checked,
            'admin' : $('#showAdmin').checked
        },
        'sort' : $('#sortBy').value,
        'order' : $("#sortOrder").value == 'sortDesc' ? 'desc' : 'asc'
    };
}

function setSortOrderValues()
{
    let sortBy = $('#sortBy').value;
    if (sortBy == 'level')
    {
        $('#sortDesc').text = 'Highest to Lowest';
        $('#sortAsc').text = 'Lowest to Highest';
    }
    else if (sortBy == 'name')
    {
        $("#sortDesc").text = "A-Z";
        $("#sortAsc").text = "Z-A";
    }
    else
    {
        $("#sortDesc").text = "Newest First";
        $("#sortAsc").text = "Oldest First";
    }
}

function filterHtml()
{
    let options = [];

    let checkboxes =
    {
        'New Members' : 'showNew',
        'Regulars' : 'showRegular',
        'Admins' : 'showAdmin'
    };

    for (let [label, name] of Object.entries(checkboxes))
    {
        options.push(buildTableFilterCheckbox(label, name));
    }

    options.push(buildNode('hr'));

    options.push(buildTableFilterDropdown(
        'Sort By',
        {
            'Account Age' : 'id',
            'Name' : 'name',
            'Last Seen' : 'seen',
            'Level' : 'level',
        }));

    options.push(buildTableFilterDropdown(
        'Sort Order',
        {
            'Newest First' : 'sortDesc',
            'Oldest First' : 'sortAsc'
        },
        true /*addId*/));
    options.push(buildNode('hr'))

    return filterHtmlCommon(options);
}

function hasProp(item, property)
{
    return item.hasOwnProperty(property);
}

function getFilter()
{
    let filter = null;
    try
    {
        filter = JSON.parse(localStorage.getItem(tableIdCore() + '_filter'));
    }
    catch (e)
    {
        logError('Unable to parse stored filter, resetting');
    }

    if (filter == null ||
        !hasProp(filter, 'type') ||
            !hasProp(filter.type, 'new') ||
            !hasProp(filter.type, 'regular') ||
            !hasProp(filter.type, 'admin') ||
        !hasProp(filter, 'sort') ||
        !hasProp(filter, 'order'))
    {
        if (filter != null)
        {
            logError(filter, 'Bad filter, resetting');
        }

        filter = defaultFilter();
        setFilter(filter, false);
    }

    logVerbose(filter, 'Got Filter');
    return filter;
}

function defaultFilter()
{
    return {
        'type' :
        {
            'new' : true,
            'regular' : true,
            'admin' : true
        },
        'sort' : 'id',
        'order' : 'asc'
    };
}

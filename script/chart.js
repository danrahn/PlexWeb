/// <summary>
/// A basic charting library
///
/// Currently only supports pie charts
/// </summary>

/* eslint-disable id-length */ // svg elements often have single-digit identifiers
/* exported Chart */

// eslint-disable-next-line max-lines-per-function
let Chart = new function()
{
    /// <summary>
    /// Returns a pie chart in SVG form
    /// </summary>
    /// <param name="data">
    /// Required fields:
    ///  radius : the radius of the circle
    ///  points : the values to chart
    ///    Each point requires a 'value' and a 'label'
    ///
    /// Optional fields:
    ///  colors:
    ///    An array of colors to override the default choices
    ///  noSort:
    ///    If true, points will not be sorted before creating the chart
    ///  labelOptions:
    ///    A dictionary of flags that determine the label:
    ///      percentage - show the percentage of the total (default = true)
    ///      count - show the raw value (default = false)
    ///      name - show the name of the data point (default = true)
    /// </returns>
    this.pie = function(data)
    {
        if (!data.noSort)
        {
            data.points.sort((a, b) => a.value - b.value);
        }

        let total = data.points.reduce((acc, cur) => acc + cur.value, 0);

        let r = data.radius;
        let svg = makeSvg(r * 2, r * 2);
        --r; // Need space for border
        let cumulative = 0;
        let colors = data.colors ? data.colors : ["#FFC000", "#5B9BD5", "#70AD47", "#4472C4", "#ED7D31", "#A5A5A5"];
        let colorIndex = 0;
        for (let point of data.points)
        {
            let startPoint = getPoint(r, cumulative, total);
            let d = `M ${r} ${r} L ${startPoint.x} ${startPoint.y} `;

            cumulative += point.value;

            let endPoint = getPoint(r, cumulative, total);
            let sweep = (point.value > total / 2) ? "1" : "0";
            d += `A ${r} ${r} ${sweep} ${sweep} 0 ${endPoint.x} ${endPoint.y} `;
            d += `L ${endPoint.x} ${endPoint.y} ${r} ${r}`;
            let arc = buildNodeNS("http://www.w3.org/2000/svg",
                "path",
                {
                    d : d,
                    fill : colors[colorIndex++ % colors.length],
                    stroke : "#616161",
                    "pointer-events" : "all",
                    xmlns : "http://www.w3.org/2000/svg"
                });

            let label = buildPieTooltip(point, total, data.labelOptions);
            if (label.length != 0)
            {
                addTooltip(arc, label);
            }

            svg.appendChild(arc);
        }
        return svg;
    };

    /// <summary>
    /// Extremely basic bar graph support
    ///
    /// Required Fields:
    ///   width : the width of the chart
    ///   height : the height of the chart
    ///   points : an array of { value, label } pairs
    /// </summary>
    this.bar = function(data)
    {
        // For now, don't bother with negative values and assume all charts start at 0
        let max = data.points.reduce((acc, cur) => acc < cur.value ? cur.value : acc, 0);

        let svg = makeSvg(data.width, data.height);

        // Give 5% for the left/bottom labels (even though they aren't implemented yet, and 5% probably isn't enough)
        let fp = { x : data.width * 0.05, y : data.height * 0.05 };
        let axisWidth = Math.max(1, Math.round(data.height / 100));
        let axis = buildNodeNS(
            "http://www.w3.org/2000/svg",
            "polyline",
            {
                points : `${fp.x},0 ${fp.x},${data.height - fp.y} ${data.width},${data.height - fp.y} `,
                stroke : "#616161",
                "stroke-width" : axisWidth,
                fill : "none"
            }
        );

        svg.appendChild(axis);

        let gridWidth = data.width - axisWidth - fp.x;
        let gridHeight = data.height - axisWidth - fp.y;
        let per = gridWidth / data.points.length;
        let barWidth = per >= 4 ? parseInt(per / 4 * 3) : per;

        let offsetX = axisWidth + fp.x;

        for (let point of data.points)
        {
            let height = gridHeight * (point.value / max);
            let bar = buildRect(offsetX, gridHeight - height, barWidth, height, "#4472C4");
            addTooltip(bar, `${point.label}: ${point.value}`);
            svg.appendChild(bar);

            // Also build a ghost bar for better tooltips, especially with small bars
            if (gridHeight - height > 1)
            {
                let ghostBar = buildRect(offsetX, 0, barWidth, gridHeight, "none", { "pointer-events" : "all" });
                addTooltip(ghostBar, `${point.label}: ${point.value}`);
                ghostBar.addEventListener("mouseenter", function() { this.setAttribute("stroke", "#616161"); });
                ghostBar.addEventListener("mouseleave", function() { this.setAttribute("stroke", "none"); });
                svg.appendChild(ghostBar);
            }

            offsetX += per;
        }


        return svg;
    };

    /// <summary>
    /// Returns a rectangle with the given start coordinates, width, height, and fill color
    /// </summary>
    /// <param name="extra">Any extra attributes that that should be added outside of the named parameters</pram>
    let buildRect = function(x, y, width, height, fill, extra)
    {
        let rect = buildNodeNS(
            "http://www.w3.org/2000/svg",
            "rect",
            {
                x : x,
                y : y,
                width : width,
                height : height,
                fill : fill
            }
        );

        if (extra)
        {
            for (let [key, value] of Object.entries(extra))
            {
                rect.setAttribute(key, value);
            }
        }

        return rect;
    };

    /// <summary>
    /// Builds and returns the tooltip label for the given point, based on the given options
    /// </summary>
    let buildPieTooltip = function(point, total, labelOptions)
    {
        let label = "";
        let percentage = (point.value / total * 100).toFixed(2);
        if (!labelOptions)
        {
            return `${point.label} (${percentage}%)`;
        }

        if (labelOptions.name === undefined || labelOptions.name)
        {
            label += point.label;
        }

        if (labelOptions.count)
        {
            label += ` - ${point.value}`;
        }

        if (labelOptions.percentage === undefined || labelOptions.percentage)
        {
            label += ` (${percentage}%)`;
        }

        return label;
    };

    /// <summary>
    /// Adds hover tooltips to the given data point
    /// </summary>
    let addTooltip = function(element, label)
    {
        Tooltip.setTooltip(element, label, 50);
    };

    /// <summary>
    /// Given a value and total, returns a point on a circle of
    /// the given radius that is (value / total * 100) percent of the circle
    /// <summary>
    let getPoint = function(radius, value, total)
    {
        // Need to translate coordinate systems
        let angle = (value / total) * Math.PI * 2;
        let x = radius * Math.cos(angle) + radius + 1; // + 1 to account for stroke border
        let y = radius - radius * Math.sin(angle) + 1;
        return { x : x, y : y };
    };

    /// <summary>
    /// Returns a top-level SVG container with the given width and height
    /// </summary>
    let makeSvg = function(width, height)
    {
        return buildNodeNS(
            "http://www.w3.org/2000/svg",
            "svg",
            {
                width : width,
                height : height,
                viewBox : `0 0 ${width} ${height}`,
                xmlns : "http://www.w3.org/2000/svg",
                x : 0,
                y : 0
            });
    };
}();

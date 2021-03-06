# Markdown Help
---

Table of Contents
* [What is Markdown?](#what-is-markdown)
* [Basic Syntax](#basic-syntax)
  * [Inline Elements](#inline-elements)
  * [Block Elements](#block-elements)
  * [HTML Elements](#html-elements)
* [Inline Element Details](#inline-element-details)
* [Block Element Details](#block-element-details)
* [Miscellaneous](#miscellaneous)
* [Issues](#issues)

---

## What is Markdown?

Markdown is a way to add lists, headers, formatting, and more to a document using plain text. Outlined below are the various rules that apply to various Markdown elements.

Note that this Markdown parser was written from scratch without looking at other examples, so is likely to contain bugs and run into various performance issues. For the most part though, things should work. This document is rendered using the parser, so anything that works here should work for you as well.

## Basic Syntax

### Inline Elements

1. **Formatting**
  * **Bold**: Add bold text by adding two asterisks or underscores around the text: `**Bold**` or `__Bold__`
  * *Italic*: Similar to bold, but only add a single asterisk/underscore: `*Italic*` or `_Italic_`
  * ++Underline++: Add two plus signs around the text: `++Underline++`
  * ~~Strikethrough~~: To strike through text, surround text with two tildes - `~~Strikethrough~~`
  * Super^script: To superscript text, use a caret, and optionally wrap the contents in parentheses - `Super^(script)`
  * Sub~(script): To subscript text, use a single tilde followed by parentheses. Unlike superscripts, subscripts must surround their content with parentheses - `Sub~(script)`

2. **`Code Snippets`** - To create a code snippet, surround text with backticks. This will render the text in a fixed-width font, and ignore all formatting - `` `**Code Snippet**` `` will not render as bold, but exactly as written: `**Code Snippet**`.

3. [**Links**](markdown.php) - To insert a link, type the display text in square brackets, and the link itself in parentheses: `[Display Text](https://danrahn.com)`. Links will also be inserted implicitly. If I type `danrahn.com` without additional formatting, a link will be created: danrahn.com.

4. **Images** - Very similar to links, but prefix the opening square bracket with an exclamation point: `![Alt Text](https://link/to/image.png)`.

For more details on inline elements, see [Inline Element Details](#inline-element-details)

<br>
---
<br>

### Block Elements

1. **Headers** - Add headers by prefixing lines with 1-6 '#'s, followed by the text - `# Header1`, `## Header2`, `### Header3`, ...
   ### Header3

2. **Horizontal Rules** - Three or more asterisks (`*`), dashes (`-`), or underscores (`_`) on their own line results in a horizontal rule. No other characters except spaces may be present:
  ```
  ***
  -   -   -   -
  _ _ _
  ```
  ***
  -   -   -   -
  _ _ _

3. **Code Blocks** - If an inline code snippet isn't enough, you can add a code block instead. There are two ways to do this:
  1. Indent each line with at least four spaces (with a blank line above):
    ```
        
        Code Block
            With Multiple Lines
    ```
  2. Surround blocks with three backticks or tildes:
    ~~~
    ```
    Code Block
        With Multiple Lines
    ```
    ~~~
    ```
    ~~~
    Code Block
        With Multiple Lines
    ~~~
    ```

4. **Lists**
  There are two types of lists:
  * **Ordered**:
    ```
    1. Ordered lists start with a number followed by a period
    2. And continue on with additional numbers
    ```
    1. Ordered lists start with a number followed by a period
    2. And continue on with additional numbers
  * **Unordered**:
    ```
    * Start the line with an asterisk
    * And the list will have bullet points instead of numbers
    ```
    * Start the line with an asterisk
    * And the list will have bullet points instead of numbers

5. **Quotes**
  You can add quotes by prefixing a line with a greater-than symbol:
  ```
  > This is a quote
  > It can be nested as well:
  >> This is an inner quote
  ```
  > This is a quote
  > It can be nested as well:
  >> This is an inner quote

6. **Tables**
  Tables can be created by combining three elements:
  * **Header row**: Separate columns with pipes (`|`). You can also add them to either end, but it is not necessary.
    `| Column 1 | Column 2 | Column 3`
  * **Definition Row**: For each column (separated by pipes), three or more dashes are required. No other characters are allowed, except for colons on either end, indicating alignment
    `:---|:---------:|---:`
  * **Table Rows**: These are defined exactly the same as headers rows, but immediately follow the definition

  ```
  |Column1           | Column2 | Column 3|
  |:-----------------|:---:|---:|
  Cell 1 | Cell 2 | Cell 3
  Cell 4 | Cell 5 | Cell 6
  ```
  |Column1           | Column2 | Column 3|
  |:-----------------|:---:|---:|
  Cell 1 | Cell 2 | Cell 3
  Cell 4 | Cell 5 | Cell 6

For more details on block elements, see [Block Element Details](#block-element-details)

<br>
---
<br>

## HTML Elements

While many Markdown parsers allow for arbitrary HTML insertion, this parser is more locked down to prevent creating documents that could ruin the flow of a webpage. That said, there are several "raw" HTML elements that are allowed:

1. **Line Breaks** - `<br>` or `<br />` - Insert additional line breaks

2. **Spans** - `<span[ style="..."]>...</span>` - Allows for additional styling that is otherwise unavailable with regular Markdown syntax. Unlike a "real" span though, attributes are limited, with only `style` and `class` being parsed, and only a limited set of style properties are allowed. That said, it's still comprehensive enough to make significant style changes:
  * <span style="color:green;background-color:#123456">Text color</span> - `<span style="color:green;background-color:#123456">Text color</span>`
  * <span style="font-family:serif">Font family/face</span> - `<span style="font-family:serif">Font family/face</span>`
  * <span style="text-decoration:underline overline">Text decoration</span> - `<span style="text-decoration:underline overline">Text decoration</span>`
  * <span style="letter-spacing:5px;word-spacing:10px">Text spacing</span> - `<span style="letter-spacing:5px;word-spacing:10px">Text spacing</span>`
  * **++<span style="color:green">_Combined with regular Markdown_</span>++** - `**++<span style="color:green">_Combined with regular Markdown_</span>++**`

  As an inline element, spans can also only be defined on a single line. To have a single span affect multiple lines, you can insert breaks inline.

3. **Style** - `<style>...</style>` - Allows for custom styling of the document via both class and element definitions:
  * ```
    # <span class="header">Header1</span>
    ...
    ## <span class="header">Header2</span>
    <style>
    .header {
      color : blue;
      background-color: green;
    }
    h1 {
      letter-spacing: 4px;
    }
    </span>
    ```
  * Like regular styling, any inline styles will override class-defined styles. Similarly, multiple classes can be defined using a space delimiter (`class="class1 class2"`), and `!important` attributes take precedence over any non-!important definition.

4. **Comments** - Anything between `<!--` and `-->` will be ignored and unescaped, acting exactly like a regular HTML comment.

5. Note: HTML elements are greedy, meaning that if you have a `<style> ... </style>` pair, nothing inside of that pair will be parsed as markdown.  So something like
  ```
  <style>
  ++Markdown!++
  `Inline code </style>`
  ```
  will be rendered as a single `` ` ``, as that's all that exists outside of the `<style></style>` tag.

<br>
---
<br>

## Inline Element Details
---

<br>
### Formatting
---

  1. Formatting elements can be nested to combine multiple formatting options, but must be in the correct order:
    * **Incorrect**: `***++~~All Four***++~~` - ***++~~All Four***++~~
    * **Correct**: `***++~~All Four~~++***` - ***++~~All Four~~++***
  2. To escape a formatting character, prepend a backslash:
    * `\*This won't be italicized\*` - \*This won't be italicized\*
    * `*\*\*This is italic, but not bold\*\**` - *\*\*This is italic, but not bold\*\**
  3. Superscripting - If parentheses are not used, text will be superscripted until whitespace is found:
    * * `Only^one word` - Only^one word
      * `Captures^(both words)` - Captures^(both words)
      * `Nothing^ Superscripted` - Nothing^ superscripted
      * `Needs^( parens)` - Needs^( parens)
    * This can also cause issues when combining formatting:
      * **Incorrect**: `**Bold^Superscript**?` - **Bold^Superscript**?
      * **Correct**: `**Bold^(Superscript)**?` - **Bold^(Superscript)**?

<br>
### Code Snippets
---

1. If you want to include backticks in your snippet, you can surround the text with multiple backticks:
    ```` ```Three backticks can encapsulate two backticks (``) ``` ````

<br>
### Links
---

1. Display text can have formatting applied just like any other part of the document: ``[**Formatted** `link`](markdown.php)`` - [**Formatted** `link`](markdown.php)

2. **Alternate form**:  In addition to inline links as described above, there are also reference links. These allow you to specify the link itself elsewhere, and reference it in multiple other areas using the following syntax:
  ```
  [Display Text][Ref]
  [Another Link][Ref]
  ...
  [Ref]: danrahn.com
  ```
  This is equivalent to
  ```
  [Display Text](danrahn.com)
  [Another Link](danrahn.com)
  ```

### Images

In addition to alt text, you can also specify the width and/or height of the image within the square brackets, in terms of either pixels or percentage, with the general form being `![Alt Text w=width,h=height](url)`. This leads to a multitude of options:
  * `![AltText](url)` - Default. Image size remains true to original (but not exceeding the bounds of the page)
  * `![AltText w=100](url)` - Width of 100 pixels. Height scales accordingly
  * `![AltText h=100](url)` - Height of 100 pixels. Width scales accordingly
  * `![AltText w=100,h=100](url)` - Width and height of 100 pixels. May lead to distortion
  * `![AltText w=50%](url)` - Width is 50% of the page. Height scales accordingly
  * `![AltText h=50%](url)` - Height is 50% of its original size. Width scales accordingly

For example, `![Poster w=100](poster/movieDefault.svg)`:
  ![Poster w=100](poster/movieDefault.svg)

<br>
---
<br>

## Block Element Details
---

### Headers
---
Whenever a header is added, it is also given an id based on the display text of the header.

In order to ensure that a valid HTML id is provided the following rules apply:
  * Everything is converted to lowercase
  * Spaces are replaced with dashes
  * Anything that's not a number, letter, underscore, or dash are removed
  * If the id starts with a number, an underscore is prefixed to the id

**Examples**:
  Markdown | ID
  ---|---
  `# Header` | header
  `## (Header)` | header
  `# 3 Easy Steps` | _3-easy-steps
  `# __Header **with** Formatting__` | header-with-formatting

These ids can then be referenced in links in order to navigate around the page:
```
## Top of Page

Some more text here

[Go to Top](#top-of-page)
```

'#'s can also be appended to a header. Any trailing '#'s will be ignored and removed, unless escaped with a backslash


<br>
### Code Blocks
---

If code blocks are nested inside of a list, they must be indented two additional spaces from the list indentation level:

**Bad**:
1. 
  ~~~
  1. Here's a code block:
  ```
  This isn't nested
  ```
  ~~~
2. 
  ~~~
  1. Here's a code block:
      
      This isn't nested either
  ~~~

**Good**:
1. 
  ~~~
  1. Here's a code block:
    ```
    This is nested
    ```
  ~~~
  > 1. Here's a code block:
  >   ```
  >   This is nested
  >   ```
2. 
  ~~~
  1. Here's a code block:

        This is nested too
  ~~~
  > 1. Here's a code block:
  >       This is nested too


<br>
### Lists
---

1. Ordered lists will always start with the first number given, then increment by one:
  ```
  4. This list will start at four
  6. And continue incrementing by one
  2. Regardless of the number given
  ```
  4. This list will start at four
  6. And continue incrementing by one
  2. Regardless of the number given

2. Lists can be nested inside of each other, requiring two additional spaces per indentation level
  ```
  1. Top level
    * First nest
      * Second Nest
        0. Third nest
        5. Third nest
      * Second nest
    1. First nest, but a different list than above, as ordered and unordered lists cannot be combined
  2. Top level
  ```
  1. Top level
    * First nest
      * Second Nest
        0. Third nest
        5. Third nest
      * Second nest
    1. First nest, but a different list than above, as ordered and unordered lists cannot be combined
  2. Top level

<br>
### Quotes
---

Like lists, quotes can also be nested. Additionally, quotes can be nested inside of lists, and vice-versa:

```
1. > * > Quote in a list in a quote in a list!
```
1. > * > Quote in a list in a quote in a list!

<br>
### Tables
---

Table cells can also contain markdown, but block elements (lists, quotes, code blocks) are not allowed:
```
| Column1          | Column2   | Column3 |
|:-----------------|:---------:|---:|
Pipes at the start | and end | are optional
| Left-Aligned | Centered | Right-Aligned |
| Second row defines<br>the columns. | At least 3 dashes<br>are required | but more are allowed |
|| Multiple Pipes | for empty cells |
| Add line breaks<br>with \<br>
| ++Cells can be formatted++ | [with any inline elements](#) | ![Poster h=150](poster/movieDefault.svg) |
```
| Column1          | Column2   | Column3 |
|:-----------------|:---------:|---:|
Pipes at the start | and end | are optional
| Left-Aligned | Centered | Right-Aligned |
| Second row defines<br>the columns. | At least 3 dashes<br>are required | but more are allowed |
|| Multiple Pipes | for empty cells |
| Add line breaks<br>with \<br>
| ++Cells can be formatted++ | [with any inline elements](#) | ![Poster h=150](poster/movieDefault.svg) |


<br>
---

## Miscellaneous
1. Potential improvements:
  1. Processing lists could be more efficient. Currently we first look for the bounds of the entire table, then go through all the same text again looking for the individual ListItems. Would be better to cache the ListItems along the way

## Issues
1. No major issues/deficiencies are currently known, but many smaller bugs/quirks exist that are too trivial/transient to list here.


<br>
([Back to Top](#markdown-help))
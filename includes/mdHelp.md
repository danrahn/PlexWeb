# Markdown Parser

Hello! This is my Markdown Parser. It's a bit slow, but what do you expect from someone who wrote it from scratch in their spare time?  The following is written with the parser, so anything that works here should work everywhere.

## Parser Status

### Complete

* **Inline Elements**
  1. **Bold** - `**Bold**` or `__Bold__`
  2. *Italic* - `*Italic*` or `_Italic_`
  3. ++Underline++ - `++Underline++`
  4. ~~Strikethrough~~ - `~~Strikethrough~~`
  5. ***++~~All Four At Once~~++*** - `***++~~All Four At Once~~++***`
  6. `Inline Code Snippets` - `` `Inline Code Snippets` ``
    * Escape backticks by surrounding with more backticks: ```` ```I can escape two backticks (``) with this``` ````
  7. [Links](markdown.php) - `[Links](markdown.php)`
    * Links can also be [++*Formatted*++](markdown.php) - `[++*Formatted*++](markdown.php)`
    * You can also define links outside of their immediate use to reduce repetition:
      [Click Me!][1]
      [Click Me Too!][1]
      [1]: markdown.php
      ```
      [Click Me!][1]
      [Click Me Too!][1]
      [1]: markdown.php
      ```
  8. **Images** - `![Poster w=100](poster/zxGkno93ExrTMsJVllH6mzQ652z.jpg)`
    ![Poster w=100](poster/zxGkno93ExrTMsJVllH6mzQ652z.jpg)
    * General form: `![AltText w=Width,h=Height](url)`:
      * `![AltText](url)`
      * `![AltText w=100](url)`
      * `![AltText h=100](url)`
      * `![AltText w=100,h=50](url)`

* **Block Elements**
  1. `# Header1`, `## Header2`, ... , `###### Header6`
    ### Header 3
    Headers also create `id`s that can be referenced via links. `[Go to Header3](#header-3)`. Special characters are removed and spaces are replaced with dashes

  2. **Code Blocks** - Either indented with four spaces (and a blank line above), or surrounded with three backticks (`` ` ``) or tildes (`~`)
    ```

        Code Block
          Note that when nested in a list, the block must be indented 4 + (nestlevel * 2) spaces:
          1. Level 1
            * Level 2

                  Code Block
    ```
    Or

        ```
        Code Block
        ```
  3. Lists
    ```
    3. Ordered lists will start at the first number given
    6. And always increase by one, regardless of what is written
    5. I can continue a list item on the next line
    without indenting

      But if I want to add a line break, it must be indented 2 additional spaces
      1. Nested lists must be indented 2 spaces from their parent
        * Ordered and unordered lists can be nested together
          ~~~
          Tilde/Backtick code blocks must start two spaces
          after the bullet, even if there's no line break
          ~~~
    ```
    3. Ordered lists will start at the first number given
    6. And always increase by one, regardless of what is written
    5. I can continue a list item on the next lin
e    without indenting

      But if I want to add a line break, it must be indented 2 additional spaces
      1. Nested lists must be indented 2 spaces from their parent
        * Ordered and unordered lists can be nested together
          ~~~
          Tilde/Backtick code blocks must start two spaces
          after the bullet, even if there's no line break
          ~~~
  4. **Block Quotes**
    ```
    >A Quote:
    >> These can be nested
    >>> By adding more '>'
    >>\> Escape these (and most other special characters) with backslashes
    ```
    >You said:
    >> These can be nested
    >>> By adding more '>'
    >>\> Escape these (and most other special characters) with backslashes
  5. **Tables**
    ```
    | Column1          | Column2   | Column3 |
    |:-----------------|:---------:|---:|
    Pipes at the start | and end | are optional
    | Left-Aligned | Centered | Right-Aligned |
    | Second row defines<br>the columns. | At least 3 dashes<br>are required | but more are allowed |
    || Multiple Pipes | for empty cells |
    | Add line breaks<br>with \<br>
    | ++Cells can be formatted++ | [with any inline elements](#) | ![Poster h=150](poster/zxGkno93ExrTMsJVllH6mzQ652z.jpg) |
    ```
    | Column1          | Column2   | Column3 |
    |:-----------------|:---------:|---:|
    Pipes at the start | and end | are optional
    | Left-Aligned | Centered | Right-Aligned |
    | Second row defines<br>the columns. | At least 3 dashes<br>are required | but more are allowed |
    || Multiple Pipes | for empty cells |
    | Add line breaks<br>with \<br>
    | ++Cells can be formatted++ | [with any inline elements](#) | ![Poster h=150](poster/zxGkno93ExrTMsJVllH6mzQ652z.jpg) |
  6. **Horizontal Rules** - at least 3 `-`, `*`, or `_` on their own line
    ```
    ---
    *   *   *   *
        _ _ _ _
    ```
    ---
    *   *   *   *
        _ _ _ _

### In Progress/Not Done
* **Nesting** - This is the biggest current issue. While most things play nice with nested lists and nested block quotes, nesting lists/quotes within quotes/lists needs work. This includes downstream issues with elements that span multiple lines (code blocks/tables), who will have to know whether leading `>`, `*`, `\d+\.` are expected and should be ignored.
* Many other things I'm sure
/* eslint-disable quote-props */
module.exports = {
    "env" : {
        "browser" : true,
        "es2020" : true
    },
    "extends" : "eslint:recommended",
    "parserOptions" : {
        "ecmaVersion" : 11
    },
    "rules" : {
        "accessor-pairs" : "error",
        "array-bracket-newline" : "off",
        "array-bracket-spacing" : ["error", "never"],
        "array-callback-return" : "error",
        "array-element-newline" : ["error", "consistent"],
        "arrow-body-style" : "error",
        "arrow-parens" : "off",
        "arrow-spacing" : [
            "error",
            {
                "after" : true,
                "before" : true
            }
        ],
        "block-scoped-var" : "error",
        "block-spacing" : "off",
        "brace-style" : ["error", "allman", { "allowSingleLine" : true }],
        "callback-return" : "error",
        "camelcase" : ["error", // Camelcase is harder to strictly enforce because my php syntax is snake_case
            { "allow" :
                [
                    "^g_",
                    "last_scanned",
                    "req_type",
                    "_id$",
                    "_pass$",
                ] }],
        "capitalized-comments" : ["error",
            "always",
            {
                "ignorePattern" : "h[\\dr]|\\w+\\.\\w+|\\btextarea\\b|\\w+=",
                "ignoreInlineComments" : true,
                "ignoreConsecutiveComments" : true
            }],
        "class-methods-use-this" : "error",
        "comma-dangle" : "off",
        "comma-spacing" : "off",
        "comma-style" : [
            "error",
            "last"
        ],
        "complexity" : "error",
        "computed-property-spacing" : [
            "error",
            "never"
        ],
        "consistent-return" : "error",
        "consistent-this" : "off",
        "curly" : "off",
        "default-case" : "error",
        "default-case-last" : "off",
        "default-param-last" : "error",
        "dot-location" : "error",
        "dot-notation" : "error",
        "eol-last" : "error",
        "eqeqeq" : "off",
        "func-call-spacing" : "error",
        "func-name-matching" : "error",
        "func-names" : "off",
        "func-style" : "off",
        "function-call-argument-newline" : ["error", "consistent"],
        "function-paren-newline" : "off",
        "generator-star-spacing" : "error",
        "global-require" : "error",
        "grouped-accessor-pairs" : "error",
        "guard-for-in" : "error",
        "handle-callback-err" : "error",
        "id-blacklist" : "error",
        "id-length" : ["error", { "exceptions" : ["$", "$$", "i", "j", "e", "x", "y"] }],
        "id-match" : "error",
        "implicit-arrow-linebreak" : [
            "error",
            "beside"
        ],
        "indent" : ["error", 4, { "SwitchCase" : 1 }],
        "indent-legacy" : "off",
        "init-declarations" : "off",
        "jsx-quotes" : "error",
        "key-spacing" : ["error", { "beforeColon" : true }],
        "keyword-spacing" : "error",
        "line-comment-position" : "off",
        "linebreak-style" : [
            "error",
            "windows"
        ],
        "lines-around-comment" : "error",
        "lines-around-directive" : "error",
        "lines-between-class-members" : [
            "error",
            "always",
            {
                "exceptAfterSingleLine" : true
            }
        ],
        "max-classes-per-file" : "off",
        "max-depth" : "error",
        "max-len" : ["error", { "code" : 150 }],
        "max-lines" : "off",

        // Don't count comments or blank lines, since allman already results in longer functions line-wise
        "max-lines-per-function" : ["error", { "max" : 50, "skipComments" : true, "skipBlankLines" : true }],
        "max-nested-callbacks" : "error",
        "max-params" : "off",
        "max-statements" : "off",
        "max-statements-per-line" : "off",
        "multiline-comment-style" : "off",
        "multiline-ternary" : "off",
        "new-cap" : "error",
        "new-parens" : "error",
        "newline-after-var" : "off",
        "newline-before-return" : "off",
        "newline-per-chained-call" : "off",
        "no-alert" : "off",
        "no-array-constructor" : "error",
        "no-await-in-loop" : "error",
        "no-bitwise" : "off",
        "no-buffer-constructor" : "error",
        "no-caller" : "error",
        "no-catch-shadow" : "off",
        "no-cond-assign" : [
            "error",
            "except-parens"
        ],
        "no-confusing-arrow" : "off",
        "no-console" : "off",
        "no-constant-condition" : [
            "error",
            {
                "checkLoops" : false
            }
        ],
        "no-constructor-return" : "error",
        "no-continue" : "off",
        "no-div-regex" : "error",
        "no-duplicate-imports" : "error",
        "no-else-return" : "error",
        "no-empty-function" : "off",
        "no-eq-null" : "error",
        "no-eval" : "error",
        "no-extend-native" : "error",
        "no-extra-bind" : "error",
        "no-extra-label" : "error",
        "no-extra-parens" : "off",
        "no-floating-decimal" : "error",
        "no-implicit-globals" : "off",
        "no-implied-eval" : "error",
        "no-inline-comments" : "off",
        "no-inner-declarations" : [
            "error",
            "functions"
        ],
        "no-invalid-this" : "off",
        "no-iterator" : "error",
        "no-label-var" : "error",
        "no-labels" : "error",
        "no-lone-blocks" : "error",
        "no-lonely-if" : "off",
        "no-loop-func" : "error",
        "no-loss-of-precision" : "error",
        "no-magic-numbers" : "off",
        "no-mixed-operators" : "off",
        "no-mixed-requires" : "error",
        "no-multi-assign" : "off",
        "no-multi-spaces" : ["error", { "ignoreEOLComments" : true }],
        "no-multi-str" : "error",
        "no-multiple-empty-lines" : "error",
        "no-native-reassign" : "error",
        "no-negated-condition" : "error",
        "no-negated-in-lhs" : "error",
        "no-nested-ternary" : "off",
        "no-new" : "off",
        "no-new-func" : "error",
        "no-new-object" : "error",
        "no-new-require" : "error",
        "no-new-wrappers" : "error",
        "no-octal-escape" : "error",
        "no-param-reassign" : "off",
        "no-path-concat" : "error",
        "no-plusplus" : "off",
        "no-process-env" : "error",
        "no-process-exit" : "error",
        "no-proto" : "error",
        "no-redeclare" : [
            "error",
            {
                "builtinGlobals" : false
            }
        ],
        "no-restricted-exports" : "error",
        "no-restricted-globals" : "error",
        "no-restricted-imports" : "error",
        "no-restricted-modules" : "error",
        "no-restricted-properties" : "error",
        "no-restricted-syntax" : "error",
        "no-return-assign" : "error",
        "no-return-await" : "error",
        "no-script-url" : "error",
        "no-self-compare" : "error",
        "no-sequences" : "error",
        "no-shadow" : "error",
        "no-spaced-func" : "off",
        "no-sync" : "error",
        "no-tabs" : [
            "error",
            {
                "allowIndentationTabs" : true
            }
        ],
        "no-template-curly-in-string" : "error",
        "no-ternary" : "off",
        "no-throw-literal" : "error",
        "no-trailing-spaces" : "error",
        "no-undef-init" : "error",
        "no-undefined" : "off",
        "no-underscore-dangle" : "off",
        "no-unmodified-loop-condition" : "error",
        "no-unneeded-ternary" : "error",
        "no-unused-expressions" : "error",
        "no-use-before-define" : "off",
        "no-useless-backreference" : "error",
        "no-useless-call" : "error",
        "no-useless-computed-key" : "error",
        "no-useless-concat" : "error",
        "no-useless-constructor" : "error",
        "no-useless-rename" : "error",
        "no-useless-return" : "error",
        "no-var" : "error",
        "no-void" : "error",
        "no-warning-comments" : "error",
        "no-whitespace-before-property" : "error",
        "nonblock-statement-body-position" : "error",
        "object-curly-newline" : "error",
        "object-curly-spacing" : ["error", "always"],
        "object-property-newline" : "off",
        "object-shorthand" : "off",
        "one-var" : "off",
        "one-var-declaration-per-line" : "error",
        "operator-assignment" : "error",
        "operator-linebreak" : [
            "error",
            "after"
        ],
        "padded-blocks" : "off",
        "padding-line-between-statements" : "error",
        "prefer-arrow-callback" : "off",
        "prefer-const" : "off",
        "prefer-destructuring" : "off",
        "prefer-exponentiation-operator" : "error",
        "prefer-named-capture-group" : "off",
        "prefer-numeric-literals" : "error",
        "prefer-object-spread" : "error",
        "prefer-promise-reject-errors" : "error",
        "prefer-reflect" : "off",
        "prefer-regex-literals" : "error",
        "prefer-rest-params" : "error",
        "prefer-spread" : "error",
        "prefer-template" : "off",
        "quote-props" : ["error", "as-needed"],
        "quotes" : ["error", "double", { "avoidEscape" : true, "allowTemplateLiterals" : true }],
        "radix" : [
            "error",
            "as-needed"
        ],
        "require-atomic-updates" : "error",
        "require-await" : "error",
        "require-jsdoc" : "off",
        "require-unicode-regexp" : "off",
        "rest-spread-spacing" : [
            "error",
            "never"
        ],
        "semi" : "error",
        "semi-spacing" : ["error", { "before" : false, "after" : true }],
        "semi-style" : [
            "error",
            "last"
        ],
        "sort-imports" : "error",
        "sort-keys" : "off",
        "sort-vars" : "error",
        "space-before-blocks" : "error",
        "space-before-function-paren" : ["error", { "anonymous" : "never", "named" : "never", "asyncArrow" : "always" }],
        "space-in-parens" : ["error", "never"],
        "space-infix-ops" : "off",
        "space-unary-ops" : [
            "error",
            {
                "nonwords" : false,
                "words" : false
            }
        ],
        "spaced-comment" : "off",
        "strict" : [
            "error",
            "never"
        ],
        "switch-colon-spacing" : "error",
        "symbol-description" : "error",
        "template-curly-spacing" : "error",
        "template-tag-spacing" : "error",
        "unicode-bom" : [
            "error",
            "never"
        ],
        "valid-jsdoc" : "error",
        "vars-on-top" : "off",
        "wrap-iife" : "error",
        "wrap-regex" : "off",
        "yield-star-spacing" : "error",
        "yoda" : [
            "error",
            "never"
        ]
    },
    "globals" : {
        // common.js
        "sendHtmlJsonRequest" : "readonly",
        "buildNode" : "readonly",
        "buildNodeNS" : "readonly",
        "ProcessRequest" : "readonly",
        "KEY" : "readonly",
        "$" : "readonly",
        "$$" : "readonly",
        // consolelog.js
        "logTmi" : "readonly",
        "logVerbose" : "readonly",
        "logInfo" : "readonly",
        "logWarn" : "readonly",
        "logError" : "readonly",
        "logFormattedText" : "readonly",
        "log" : "readonly",
        "LOG" : "readonly",
        "getLogLevel" : "readonly",
        "setLogLevel" : "readonly",
        "getDarkConsole" : "readonly",
        "_logErrorId" : "readonly",
        // animation.js
        "Animation" : "readonly",
        "Color" : "readonly",
        // overlay.js
        "overlay" : "readonly",
        "buildOverlay" : "readonly",
        "overlayDismiss" : "readonly",
        // tooltip.js
        "Tooltip" : "readonly",
        // iconMap.js
        "icons" : "readonly",
        // tableCommon.js
        "getPage" : "readonly",
        "setPage" : "readonly",
        "getPerPage" : "readonly",
        "setPerPage" : "readonly",
        "setPageInfo" : "readonly",
        "setFilter" : "readonly",
        "addTableItem" : "readonly",
        "clearTable" : "readonly",
        "tableItemHolder" : "readonly",
        "displayInfoMessage" : "readonly",
        "buildTableFilterCheckbox" : "readonly",
        "buildTableFilterDropdown" : "readonly",
        "tableIdCore" : "readonly",
        "populateUserFilter" : "readonly",
        "filterHtmlCommon" : "readonly",
        "clearElement" : "readonly",
        "updateTable" : "readonly",
        // tableCommon.js implementors
        "supportsSearch" : "readonly",
        "filterHtml" : "readonly",
        "populateFilter" : "readonly",
        "getNewFilter" : "readonly",
        "defaultFilter" : "readonly",
        "tableIdentifier" : "readonly",
        "tableUpdateFunc" : "readonly",
        "getFilter" : "readonly",
        // DateUtil.js
        "DateUtil" : "readonly",
        // Markdown.js
        "Markdown" : "readonly",
        // markdownHelp.js
        "MarkdownHelp" : "readonly",
        // markdownEditor.js
        "MarkdownEditor" : "readonly",
        // MarkdownText.js
        "MarkdownTestSuite" : "readonly",
        // chart.js
        "Chart" : "readonly",
        // eslintrc
        "module" : "readonly",
    },
};

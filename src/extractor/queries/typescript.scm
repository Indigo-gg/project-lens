; TypeScript/JavaScript tree-sitter queries for fact extraction

; Function declarations
(
  (function_declaration
    name: (identifier) @name
    parameters: (formal_parameters) @params
    body: (statement_block) @body
  ) @fact
)

; Arrow functions assigned to variables
(
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (arrow_function
        parameters: (formal_parameters) @params
        body: (_) @body
      )
    )
  ) @fact
)

; Method definitions in classes
(
  (method_definition
    name: (property_identifier) @name
    parameters: (formal_parameters) @params
    body: (statement_block) @body
  ) @fact
)

; Class declarations
(
  (class_declaration
    name: (type_identifier) @name
    body: (class_body) @body
  ) @fact
)

; Interface declarations
(
  (interface_declaration
    name: (type_identifier) @name
    body: (interface_body) @body
  ) @fact
)

; Type alias declarations
(
  (type_alias_declaration
    name: (type_identifier) @name
    value: (_) @body
  ) @fact
)

; Enum declarations
(
  (enum_declaration
    name: (identifier) @name
    body: (enum_body) @body
  ) @fact
)

; Import statements
(
  (import_statement
    source: (string) @source
  ) @fact
)

; Export statements
(
  (export_statement
    declaration: (_) @declaration
  ) @fact
)

; Variable declarations
(
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (_) @value
    )
  ) @fact
)

; Call expressions (for detecting patterns like Redis, Kafka usage)
(
  (call_expression
    function: (identifier) @func_name
    arguments: (arguments) @args
  ) @fact
)

; New expressions
(
  (new_expression
    constructor: (identifier) @constructor
    arguments: (arguments) @args
  ) @fact
)

; Method calls (e.g., redis.connect(), db.query())
(
  (call_expression
    function: (member_expression
      object: (identifier) @object
      property: (property_identifier) @property
    )
    arguments: (arguments) @args
  ) @fact
)

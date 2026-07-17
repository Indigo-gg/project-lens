; Go tree-sitter queries for fact extraction

; Function declarations
(
  (function_declaration
    name: (identifier) @name
    parameters: (parameter_list) @params
    result: (parameter_list)? @result
    body: (block) @body
  ) @fact
)

; Method declarations
(
  (method_declaration
    receiver: (parameter_list) @receiver
    name: (field_identifier) @name
    parameters: (parameter_list) @params
    result: (parameter_list)? @result
    body: (block) @body
  ) @fact
)

; Type declarations (struct, interface)
(
  (type_declaration
    (type_spec
      name: (type_identifier) @name
      type: (struct_type | interface_type) @type_def
    )
  ) @fact
)

; Import declarations
(
  (import_declaration
    (import_spec
      path: (interpreted_string_literal) @import_path
    )
  ) @fact
)

; Short variable declarations
(
  (short_var_declaration
    left: (expression_list) @names
    right: (expression_list) @values
  ) @fact
)

; Variable declarations
(
  (var_declaration
    (var_spec
      name: (identifier) @name
      type: (_)? @type_annotation
      value: (expression_list)? @value
    )
  ) @fact
)

; Function calls
(
  (call_expression
    function: (identifier) @func_name
    arguments: (argument_list) @args
  ) @fact
)

; Method calls
(
  (call_expression
    function: (selector_expression
      operand: (identifier) @object
      field: (field_identifier) @property
    )
    arguments: (argument_list) @args
  ) @fact
)

; Select statements (channels)
(
  (select_statement
    (select_clause) @clause
  ) @fact
)

; Go routines
(
  (go_statement
    call_expression: (call_expression) @call
  ) @fact
)

; Defer statements
(
  (defer_statement
    call_expression: (call_expression) @call
  ) @fact
)

; Composite literals
(
  (composite_literal
    type: (type_identifier) @type_name
    body: (literal_value) @body
  ) @fact
)

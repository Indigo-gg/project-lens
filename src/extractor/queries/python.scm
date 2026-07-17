; Python tree-sitter queries for fact extraction

; Function definitions
(
  (function_definition
    name: (identifier) @name
    parameters: (parameters) @params
    body: (block) @body
  ) @fact
)

; Class definitions
(
  (class_definition
    name: (identifier) @name
    body: (block) @body
  ) @fact
)

; Method definitions (inside classes)
(
  (function_definition
    name: (identifier) @name
    parameters: (parameters) @params
    body: (block) @body
  ) @fact
)

; Import statements
(
  (import_statement
    module_name: (dotted_name) @module
  ) @fact
)

; Import from statements
(
  (import_from_statement
    module_name: (dotted_name) @module
  ) @fact
)

; Decorated definitions
(
  (decorated_definition
    (decorator) @decorator
    definition: (_) @definition
  ) @fact
)

; assignments
(
  (expression_statement
    (assignment
      left: (identifier) @name
      right: (_) @value
    )
  ) @fact
)

; Function calls
(
  (call
    function: (identifier) @func_name
    arguments: (arguments) @args
  ) @fact
)

; Method calls
(
  (call
    function: (attribute
      object: (identifier) @object
      attribute: (identifier) @property
    )
    arguments: (arguments) @args
  ) @fact
)

; Type annotations
(
  (type
    (identifier) @type_name
  ) @fact
)

; Variable annotations
(
  (expression_statement
    (assignment
      left: (identifier) @name
      type: (type) @type_annotation
    )
  ) @fact
)

"use client";

// From tungv/demo-gallery-app (src/components/ui/form.tsx). Its Tailwind classes are in styles.css, keyed on
// each part's `data-slot`; a caller's own handlers now run alongside the form's instead of being dropped.
import { createReducerContext } from "@tungv/react-reducer-context";
import { Hidden, Visible } from "@tungv/react-reserve-layout";
import { Slot } from "@tungv/react-slot";
import { useEffect, useId } from "react";
import type { ComponentProps, FormEvent, MouseEvent } from "react";
import { useFormStatus } from "react-dom";

interface FormContext {
  fields: Record<
    string,
    {
      validity: Partial<ValidityState> & {
        customErrorValidationMessage?: string;
      };
      userInteracted: boolean;
    }
  >;
  resetCounter: number;
}

type ValidityStateWithCustomErrorValidationMessage = Partial<ValidityState> & {
  customErrorValidationMessage?: string;
};

const defaultContext: FormContext = {
  fields: {},
  resetCounter: 0,
};

type FormContextAction =
  | {
      type: "set_field_validity";
      fieldName: string;
      validity: ValidityStateWithCustomErrorValidationMessage;
      validationMessage: string;
    }
  | { type: "reset_field_validity"; fieldName: string }
  | { type: "reset_all_validity" }
  | { type: "set_all_fields_interacted" };

function validityStateToPlainObject(
  validity: Partial<ValidityState>,
  validationMessage: string,
): ValidityStateWithCustomErrorValidationMessage {
  const props = [
    "valid",
    "valueMissing",
    "typeMismatch",
    "patternMismatch",
    "tooLong",
    "tooShort",
    "rangeOverflow",
    "rangeUnderflow",
    "stepMismatch",
  ];

  const obj = {} as Partial<
    Record<keyof ValidityState, boolean> & {
      customErrorValidationMessage?: string;
    }
  >;

  for (const prop of props) {
    if (validity[prop as keyof ValidityState] === true) {
      obj[prop as keyof ValidityState] = true;
    }
  }

  if (validity.customError) {
    obj.customError = true;
    obj.customErrorValidationMessage = validationMessage;
  }

  return obj;
}

const [FormContextProvider, useFormContext, useFormDispatch] =
  createReducerContext(
    (state: FormContext, action: FormContextAction): FormContext => {
      switch (action.type) {
        case "set_field_validity":
          return {
            ...state,
            fields: {
              ...state.fields,
              [action.fieldName]: {
                validity: validityStateToPlainObject(
                  action.validity,
                  action.validationMessage,
                ),
                userInteracted: true,
              },
            },
          };
        case "reset_field_validity": {
          const { [action.fieldName]: _, ...remainingFields } = state.fields;
          return {
            ...state,
            fields: {
              ...remainingFields,
              [action.fieldName]: {
                validity: { valid: true },
                userInteracted: false,
              },
            },
          };
        }
        case "reset_all_validity":
          return {
            ...state,
            fields: {},
            resetCounter: state.resetCounter + 1,
          };
        case "set_all_fields_interacted": {
          const updatedFields = { ...state.fields };

          // Set all fields as interacted
          for (const [fieldName, field] of Object.entries(updatedFields)) {
            updatedFields[fieldName] = {
              ...field,
              userInteracted: true,
            };
          }

          return {
            ...state,
            fields: updatedFields,
          };
        }
        default:
          return state;
      }
    },
    defaultContext,
  );

function useFormFieldValidationState(fieldName: string) {
  const context = useFormContext();
  const field = context.fields[fieldName];

  return field?.validity || { valid: true };
}

function useResetForm() {
  const dispatch = useFormDispatch();

  return () => {
    dispatch({
      type: "reset_all_validity",
    });
  };
}

function useUpdateValidity(fieldName: string) {
  const dispatch = useFormDispatch();

  return (validity: Partial<ValidityState>, validationMessage: string) => {
    dispatch({
      type: "set_field_validity",
      fieldName,
      validity,
      validationMessage,
    });
  };
}

function useResetValidity(fieldName: string) {
  const dispatch = useFormDispatch();

  return () => {
    dispatch({ type: "reset_field_validity", fieldName });
  };
}

/**
 * Form
 *
 * Anatomy:
 *
 * ```tsx
 * <Form>
 *  <FormField name="field_name">
 *    <FormLabel />
 *    <InputControl asChild>
 *      <Input />
 *    </InputControl>
 *    <FormMessage />
 *  </FormField>
 *  <FormSubmit />
 * </Form>
 * ```
 *
 *
 */

interface FormProps extends ComponentProps<"form"> {
  asChild?: boolean;
}

// Add interface for custom data attributes
interface FormDataAttributes {
  "data-pristine"?: "";
  "data-dirty"?: "";
  "data-valid"?: "";
  "data-invalid"?: "";
  "data-user-valid"?: "";
  "data-user-invalid"?: "";
}

function useFormAttributes() {
  const formContext = useFormContext();

  // Check if form fields are valid
  const isInvalid = Object.values(formContext.fields).some(
    (field) => field.validity.valid !== true,
  );

  // Check if any field has been interacted with
  const hasUserInteractedWithAnyField = Object.values(formContext.fields).some(
    (field) => field.userInteracted,
  );

  // Create data attributes that will only be added when true
  const dataAttributes: Partial<FormDataAttributes> = {};
  const ariaAttributes: Record<string, boolean | string | undefined> = {};

  if (isInvalid) {
    dataAttributes["data-invalid"] = "";
    ariaAttributes["aria-invalid"] = "";
  } else {
    dataAttributes["data-valid"] = "";
  }

  // Add user interaction based validation states for the entire form
  if (hasUserInteractedWithAnyField) {
    if (isInvalid) {
      dataAttributes["data-user-invalid"] = "";
    } else {
      dataAttributes["data-user-valid"] = "";
    }
  }

  return { dataAttributes, ariaAttributes };
}

export function Form({ children, asChild, ...props }: FormProps) {
  const dispatch = useFormDispatch();

  // Use proper type casting for the form props
  const formProps: ComponentProps<"form"> & { "data-slot": string } = {
    "data-slot": "form",
    ...props,

    onSubmit: (event) => {
      // Mark all fields as interacted when form is submitted
      dispatch({ type: "set_all_fields_interacted" });

      // Call the original onSubmit if provided
      if (props.onSubmit) {
        props.onSubmit(event);
      }
    },

    onInvalid: (event) => {
      props.onInvalid?.(event);
      const form = event.currentTarget as HTMLFormElement;

      const invalidControl = getFirstInvalidControl(form);
      if (invalidControl) {
        invalidControl.focus();
      }

      // prevent default browser UI for form validation
      event.preventDefault();
    },
  };

  const inner = asChild ? (
    <CustomFormImpl {...formProps}>{children}</CustomFormImpl>
  ) : (
    <FormImpl {...formProps}>{children}</FormImpl>
  );

  return <FormContextProvider>{inner}</FormContextProvider>;
}

function CustomFormImpl({ children, onReset, ...props }: ComponentProps<"form">) {
  const resetForm = useResetForm();
  const { dataAttributes, ariaAttributes } = useFormAttributes();

  return (
    <Slot
      {...props}
      {...dataAttributes}
      {...ariaAttributes}
      onReset={(event: FormEvent<HTMLFormElement>) => {
        onReset?.(event);
        resetForm();
      }}
    >
      {children}
    </Slot>
  );
}

function FormImpl({ children, onReset, ...props }: ComponentProps<"form">) {
  const resetForm = useResetForm();
  const { dataAttributes, ariaAttributes } = useFormAttributes();

  return (
    <form
      {...props}
      {...dataAttributes}
      {...ariaAttributes}
      onReset={(event) => {
        onReset?.(event);
        resetForm();
      }}
    >
      {children}
    </form>
  );
}

interface FormFieldContext {
  name: string;
  id: string;
  validityState: Partial<ValidityState>;
  messageIds: string[];
}

type FormFieldAction =
  | {
      type: "add_message";
      payload: string;
    }
  | {
      type: "remove_message";
      payload: string;
    };

const defaultFormFieldContext: FormFieldContext = {
  name: "",
  id: "",
  validityState: { valid: true },
  messageIds: [],
};

const [FormFieldProvider, useFormFieldState, useFormFieldDispatch] =
  createReducerContext(
    (state: FormFieldContext, action: FormFieldAction): FormFieldContext => {
      if (action.type === "add_message") {
        return {
          ...state,
          messageIds: [...state.messageIds, action.payload],
        };
      }

      if (action.type === "remove_message") {
        return {
          ...state,
          messageIds: state.messageIds.filter((id) => id !== action.payload),
        };
      }

      return state;
    },
    defaultFormFieldContext,
  );

interface FormFieldProps extends ComponentProps<"div"> {
  name: string;
}

export function FormField({ name, children, ...props }: FormFieldProps) {
  const id = useId();

  const formFieldProps: ComponentProps<"div"> & { "data-slot": string } = {
    "data-slot": "form-field",
    ...props,
  };

  return (
    <FormFieldProvider name={name} id={id}>
      <FormFieldImpl {...formFieldProps}>{children}</FormFieldImpl>
    </FormFieldProvider>
  );
}

function FormFieldImpl({ children, ...props }: ComponentProps<"div">) {
  return <div {...props}>{children}</div>;
}

interface FormLabelProps extends ComponentProps<"label"> {}

export function FormLabel({ children, onMouseDown, ...props }: FormLabelProps) {
  const context = useFormFieldState();

  if (!context) {
    throw new Error("FormLabel must be used within a FormField");
  }

  const controlId = `control-${context.id}`;

  return (
    <label
      data-slot="form-label"
      {...props}
      htmlFor={controlId}
      onMouseDown={(event: MouseEvent<HTMLLabelElement>) => {
        // Only a label's own text: a control inside it keeps its own mouse handling.
        const target = event.target as HTMLElement;
        if (target.closest("button, input, select, textarea")) return;
        onMouseDown?.(event);
        // Double-clicking a label focuses its control rather than selecting the label's text.
        if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
      }}
    >
      {children}
    </label>
  );
}

interface FormControlProps extends ComponentProps<"input"> {
  asChild?: boolean;
}

interface FormControlDataAttributes {
  "data-invalid"?: boolean;
  "data-valid"?: boolean;
  "data-user-invalid"?: boolean;
  "data-user-valid"?: boolean;
}

export function InputControl({
  children,
  asChild,
  onInvalid,
  onChange,
  onBlur,
  ...props
}: FormControlProps) {
  const fieldContext = useFormFieldState();
  const formContext = useFormContext();
  const updateValidity = useUpdateValidity(fieldContext.name);
  const resetValidity = useResetValidity(fieldContext.name);

  const controlId = `control-${fieldContext.id}`;
  const field = formContext.fields[fieldContext.name] || {
    validity: { valid: true },
    userInteracted: false,
  };
  const isValid = field.validity.valid === true;
  const hasUserInteracted = field.userInteracted;

  // Create data attributes that will only be added when they're true
  const dataAttributes: Partial<FormControlDataAttributes> = {};
  const ariaAttributes: Record<string, boolean | string | undefined> = {};

  if (isValid) {
    dataAttributes["data-valid"] = true;
  } else {
    dataAttributes["data-invalid"] = true;
    ariaAttributes["aria-invalid"] = true;
  }

  // Add user interaction based validation states
  if (hasUserInteracted) {
    if (isValid) {
      dataAttributes["data-user-valid"] = true;
    } else {
      dataAttributes["data-user-invalid"] = true;
    }
  }

  // Only add aria-describedby if there are actual message IDs
  if (fieldContext.messageIds.length > 0) {
    ariaAttributes["aria-describedby"] = fieldContext.messageIds.join(" ");
  }

  // Only add aria attributes if they're true
  if (props.required) {
    ariaAttributes["aria-required"] = true;
  }

  if (props.disabled) {
    ariaAttributes["aria-busy"] = true;
  }

  if (props.readOnly) {
    ariaAttributes["aria-readonly"] = true;
  }

  const inputProps: ComponentProps<"input"> & FormControlDataAttributes & { "data-slot": string } = {
    ...props,
    id: controlId,
    name: fieldContext.name,
    title: "",
    ...dataAttributes,
    ...ariaAttributes,
    "data-slot": "form-control",
    onInvalid(event) {
      onInvalid?.(event);
      // this is triggered when the form is submitted and the input is invalid

      // prevent the default browser validation message from showing
      event.preventDefault();

      // update state
      const target = event.target as HTMLElement;
      if (isFormControl(target)) {
        updateValidity(target.validity, target.validationMessage);
      }
    },
    onChange(event) {
      onChange?.(event);
      // reset validity state
      // we don't want to the validation message to show up when the user is typing
      resetValidity();
    },
    onBlur(event) {
      onBlur?.(event);
      const { currentTarget } = event;
      // after the user has interacted with the input, we update the validity state to show validation errors (if any)
      if (isFormControl(currentTarget)) {
        updateValidity(currentTarget.validity, currentTarget.validationMessage);
      }
    },
  };

  if (asChild) {
    return (
      <Slot key={formContext.resetCounter} {...inputProps}>
        {children}
      </Slot>
    );
  }

  return <input {...inputProps} />;
}

interface FormMessageProps extends ComponentProps<"span"> {
  match: keyof ValidityState | string;
}

export function FormMessage({ children, match, ...props }: FormMessageProps) {
  const isInvalid = match !== "valid";
  const context = useFormFieldState();
  const validityState = useFormFieldValidationState(context.name);

  const isMatchedCustomError =
    validityState.customError &&
    validityState.customErrorValidationMessage === match;

  const shouldShowMessage =
    match in validityState
      ? validityState[match as keyof ValidityState] === true
      : /* custom error */ isMatchedCustomError === true;

  const id = useId();

  // if this component is present, add the message id to the context
  const dispatch = useFormFieldDispatch();

  useEffect(() => {
    if (!shouldShowMessage) {
      return;
    }
    dispatch({
      type: "add_message",
      payload: id,
    });

    return () => {
      dispatch({
        type: "remove_message",
        payload: id,
      });
    };
  }, [dispatch, id, shouldShowMessage]);

  const content = (
    <span
      data-slot="form-message"
      {...props}
      aria-live="polite"
      aria-atomic="true"
      id={id}
      data-invalid={isInvalid ? "" : undefined}
    >
      {children}
    </span>
  );

  if (shouldShowMessage) {
    return <Visible>{content}</Visible>;
  }

  return <Hidden>{content}</Hidden>;
}

interface FormSubmitProps extends Omit<ComponentProps<"button">, "type"> {
  asChild?: boolean;
}

export function FormSubmit({ children, asChild, ...props }: FormSubmitProps) {
  const buttonProps = {
    "data-slot": "form-submit",
    ...props,
    type: "submit" as const,
  };

  if (asChild) {
    return <Slot {...buttonProps}>{children}</Slot>;
  }

  return <button {...buttonProps}>{children}</button>;
}

export function FormSubmitMessage({
  children,
  ...props
}: ComponentProps<"span">) {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <Hidden>
        <span {...props}>{children}</span>
      </Hidden>
    );
  }

  return (
    <Visible>
      <span {...props}>{children}</span>
    </Visible>
  );
}

export function FormPendingMessage({
  children,
  ...props
}: ComponentProps<"span">) {
  const { pending } = useFormStatus();

  if (!pending) {
    return (
      <Hidden>
        <span {...props}>{children}</span>
      </Hidden>
    );
  }

  return (
    <Visible>
      <span {...props}>{children}</span>
    </Visible>
  );
}

function isHTMLElement(element: unknown): element is HTMLElement {
  return element instanceof HTMLElement;
}

function isFormControl(
  element: HTMLElement,
): element is HTMLInputElement & { validity: ValidityState } {
  return "validity" in element;
}

function isInvalid(control: HTMLElement) {
  return (
    isFormControl(control) &&
    (control.validity.valid === false ||
      control.getAttribute("aria-invalid") === "true")
  );
}

function isVisible(control: HTMLElement) {
  return (
    control.offsetParent !== null &&
    control.getAttribute("aria-hidden") !== "true"
  );
}

function getFirstInvalidControl(
  form: HTMLFormElement,
): HTMLElement | undefined {
  const elements = form.elements;

  if (!elements || elements.length === 0) {
    return undefined;
  }

  const firstInvalidControl = Array.from(elements)
    .filter(isHTMLElement)
    .filter(isInvalid)
    .filter(isVisible)
    .at(0);

  return firstInvalidControl;
}

export function FormControlItem({
  children,
  defaultItem,
  ...props
}: ComponentProps<"div"> & { defaultItem?: boolean }) {
  const fieldContext = useFormFieldState();
  const fieldName = fieldContext.name;
  const fieldId = fieldContext.id;

  const itemId = useId();
  const controlItemId = defaultItem ? `${fieldId}` : `${fieldId}-${itemId}`;

  return (
    <FormFieldProvider name={fieldName} id={controlItemId}>
      <div data-slot="form-control-item" {...props}>
        {children}
      </div>
    </FormFieldProvider>
  );
}

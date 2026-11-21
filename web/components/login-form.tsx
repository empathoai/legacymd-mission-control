"use client"

import { useActionState } from "react"

import { signIn, type LoginState } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "cn"

const initial: LoginState = { error: null, email: "" }

export function LoginForm({
  next,
  className,
  ...props
}: React.ComponentProps<"div"> & { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initial)
  const invalid = state.error !== null

  return (
    <div className={cn("flex flex-col gap-8", className)} {...props}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use the clinic account to open Mission Control.
        </p>
      </div>

      <form action={formAction}>
        <FieldGroup>
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <Field data-invalid={invalid}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@legacymd.com"
              defaultValue={state.email}
              aria-invalid={invalid}
              className="h-11"
              required
            />
          </Field>

          <Field data-invalid={invalid}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={invalid}
              aria-describedby={state.error ? "login-error" : undefined}
              className="h-11"
              required
            />
            {state.error ? (
              <FieldError id="login-error" role="alert">
                {state.error}
              </FieldError>
            ) : null}
          </Field>

          <Field>
            <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Sign in
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}

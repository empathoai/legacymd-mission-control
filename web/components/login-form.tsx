"use client"

import { useActionState } from "react"

import { signIn, type LoginState } from "@/app/actions/auth"
import { BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="items-center text-center">
          <BrandMark className="mx-auto mb-2 size-12 rounded-lg" />
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use the clinic account to open Mission Control.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  required
                />
                {state.error ? <FieldError>{state.error}</FieldError> : null}
              </Field>
              <Field>
                <Button type="submit" disabled={pending}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  Sign in
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

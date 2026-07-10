# AGENTS.md — KRUG CRM

## Project concept

KRUG CRM is an internal studio operations app for employees of the recording studio **КРУГ**.

This is not a public client booking page. Clients must not use this CRM directly. Public booking will be implemented later as a separate Telegram bot or a separate booking page connected to the CRM.

The central object of the product is **Booking / Запись**.

Main workflow:

```text
Booking → Client → Employee → Service → Payment → Report
Запись → Клиент → Сотрудник → Услуга → Платёж → Отчёт
```

The CRM should feel like an operating system for a recording studio, not like generic accounting software.

---

## Current stack

Work with the current simple stack:

- HTML
- CSS
- JavaScript
- localStorage
- Vercel public preview

Do not add a backend, database, npm, React, Vue, TypeScript, build tools, or external frameworks unless a patch explicitly asks for it.

---

## Core development rules

- Do not rewrite the project from scratch.
- Do not change the stack without explicit approval.
- Do not remove existing functionality unless the patch explicitly asks for it.
- Do not add public client booking inside the CRM.
- Do not add random features outside the current patch scope.
- Prefer small, stable, incremental changes.
- If a feature is not useful for daily studio work, do not add it.
- If implementation requires a large refactor, explain it first instead of doing it silently.

---

## Patch philosophy

### One patch = one main idea

Do not combine unrelated changes into one patch.

Bad patch:

```text
Calendar + roles + Telegram + analytics + redesign
```

Good patch:

```text
Patch 0.4 — Studio Calendar Core
```

### Every patch must answer 3 questions

Before implementing a patch, the intent should be clear:

1. What studio problem does this patch solve?
2. What becomes faster or easier after this patch?
3. Why should this patch happen now, not later?

### The 4-year rule

Before adding a feature, ask:

> Will this still be useful to the studio over the next 4 years?

If not, postpone it.

---

## Product principles

- Booking is the center of the system.
- Calendar is the main operational tool.
- Clients are built from bookings and payments.
- Payments should connect back to bookings when possible.
- Employees and performers should be assigned to bookings.
- Services must come from the service catalog.
- Settings should contain service catalog, employees, payouts, budget, profile, and common studio settings.
- CRM must stay internal for studio employees.
- Online booking and Telegram bot are separate future products, not CRM tabs.

---

## Visual identity

Preserve the KRUG visual identity:

- dark background
- black / dark gray foundation
- orange accent
- light neutral text
- soft cards
- compact CRM layout
- rounded elements
- left sidebar
- KRUG logo
- modern studio/product feel

Do not make the interface overly colorful. Use additional colors only for statuses and meaningful visual states.

Status colors guideline:

- request / заявка — neutral gray
- confirmed / подтверждено — blue
- in progress / в процессе — orange
- completed / завершено — green
- cancelled / отменено — red

---

## Roles and access concept

Role-based access is planned for a future patch. Do not implement it unless the current patch explicitly asks for it.

Future access model:

### Owner / Владелец

Full access to everything:

- today screen
- calendar
- bookings
- clients
- finance
- payments
- payouts
- budget
- reports
- settings
- service catalog
- employees
- roles and permissions

### Administrator / Администратор

Operational access:

- today screen
- calendar
- all bookings
- clients
- payments
- service catalog
- employees
- most settings

Limited or no access to owner-level profitability/budget settings unless explicitly allowed.

### Sound engineer / Звукорежиссёр

Limited access:

- own schedule
- own bookings
- own related clients
- own payouts, if needed

Should not see:

- total studio revenue
- total profit
- expenses
- budget
- payouts of other employees
- service catalog editing
- employee settings

### Performer / Исполнитель

Limited access to assigned work only.

### Designer / Дизайнер

Limited access to design-related assigned work only.

### Producer / Продюсер

Limited access to assigned sessions/projects only.

---

## Data rules

- Keep localStorage compatibility unless the patch explicitly handles migration.
- Do not rename existing storage keys without a safe migration.
- Do not delete financial data automatically.
- If a completed booking has a linked payment, deleting the booking should not delete the payment silently.
- If a booking is completed, create or update the linked payment without duplicates.
- If a service or employee is used by existing bookings/payments, do not hard-delete it silently. Prefer disable/archive behavior.

---

## Service catalog rules

The service catalog should be the single source of truth for services.

Preferred structures:

- `serviceGroups`
- `serviceItems`

Older service arrays should only be used for migration/fallback, not as the main source of selection.

Services should support:

- category/group
- name
- price
- default duration
- active/inactive state
- order

---

## Booking rules

Booking fields should include, when possible:

- id
- date
- time
- duration
- clientName
- phone
- telegram
- serviceCategoryId
- serviceId
- serviceName
- amount
- employeeId
- employeeName
- comment
- status
- paymentCreated
- paymentId
- createdAt
- updatedAt

Statuses:

- Заявка
- Подтверждено
- В процессе
- Завершено
- Отменено

---

## Review and reporting format

After implementing a patch, report:

1. Changed files
2. Added functionality
3. Fixed issues
4. Removed code, if any
5. Manual checks performed
6. Known limitations or follow-up tasks

Do not claim something was tested if it was not actually tested.

---

## Manual check checklist

When a patch touches bookings/calendar/payments, check:

- creating a booking from a button
- creating a booking from a calendar slot
- editing a booking
- changing booking status
- completing a booking
- automatic payment creation
- no duplicate payment creation
- updating a completed booking updates linked payment
- deleting a completed booking does not silently delete payment
- client from booking appears in clients
- service selection from category works
- employee selection works
- CRM has no public client booking form

---

## Public preview

The app is deployed on Vercel for testing. Public preview is for UI/UX testing only.

Because data is currently stored in localStorage, every tester has their own local data. This is expected until cloud storage/backend is introduced later.


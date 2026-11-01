# FoodGO user guide

FoodGO lets you order lunch in the morning from restaurants that registered you, and have it delivered at lunchtime by the restaurant's own delivery team.

Open the app (for the local demo: http://localhost:3000). Everyone starts on the same sign-in page.

## Customers

**Before you start:** a restaurant must register you in person (bring an ID). They record your name, phone number and workplace. FoodGO only delivers to workplaces in **Lac 3** and **Zone Industrielle Le Kram**.

1. **Sign in.** Enter your phone number (`+216…`) and tap **Send my code**. Type the 6-digit code you receive. In the demo no SMS is sent: the code is shown on screen and filled in for you.
2. **Pick a restaurant.** You see only the restaurants that registered you. The bar under each name shows the ordering deadline and how much time is left.
3. **Choose your dishes.** Tap **+** and **−** to set quantities. Dishes marked *Unavailable today* cannot be added. The bar at the bottom shows your item count and total.
4. **Review and pay.** Tap **Review order**, check the lines and total, choose **Cash on delivery** or **E-payment**, then **Place order**. You get an order number such as `FG-7K2P9Q`.
5. **Follow your order.** **My orders** shows each order's progress: received, being prepared, delivery person assigned, on the way, delivered. It updates by itself.

If you miss the deadline, the app tells you ordering is closed for today. If a dish runs out while you order, it tells you which one; remove it and try again.

## Restaurant staff

Sign in with your email and password, choosing **Restaurant staff**.

- **Today's orders** — a board with one column per stage. New orders appear on their own.
  - **Start preparing** moves an order to *Being prepared*.
  - Choose a delivery person in the drop-down and click **Assign**. Only your own team appears.
- **Prep forecast** — how many of each dish to expect for your next service, with a range and a confidence label, plus advice for the kitchen. It is advice: you decide what to cook. The "How reliable is it?" box shows how far off it has been recently.
- **Menu** — add dishes, change prices (orders already placed keep their price), switch a dish off when you run out, or remove it.
- **Customers** — register a customer in person: name, phone, workplace (each workplace shows its zone). Tick **I checked their identity in person**. Untick **They belong to an organization we serve** if they do not meet your rule. Use the switch in the list to stop or allow someone ordering later. If their workplace is missing, add it under *Missing workplace?* and choose its zone, Lac 3 or Zone Industrielle Le Kram. FoodGO does not serve other areas.
- **Delivery team** — create an account (username and temporary password) for each person you employ to deliver.
- **Settings** — your daily ordering deadline and which payment methods you accept. Changing the deadline never affects orders already placed.

## Delivery people

Sign in with the username and password your restaurant gave you, choosing **Delivery person**.

1. **My deliveries** lists the orders assigned to you. New ones appear on their own.
2. Tap an order to see where to pick it up, who to deliver to (workplace and zone), their phone number, what is in the bag and how much cash to collect.
3. When you leave with it, tap **I picked it up, start delivery**. The customer sees that you are on the way.
4. When you hand it over, tick **I collected … in cash** if it applies, then **Confirm delivered**.

## Platform administrator

Sign in with **Platform administrator**.

- **Monitoring** — today's orders per restaurant and stage, account totals, and the recent activity log (sign-ins, registrations, assignments, deliveries). Administrators can read this but cannot change orders.
- **Restaurants** — add a restaurant with its deadline and its zone (Lac 3 or Zone Industrielle Le Kram).
- **Staff accounts** — create the first staff account for a restaurant.

## Demo accounts

| Role | Sign in with | Password |
|---|---|---|
| Customer (2 restaurants) | `+21620111222` (Yasmine) | code shown on screen |
| Customer | `+21698333444` (Omar) | code shown on screen |
| Staff, Dar Lella | `staff@darlella.tn` | `Staff#2026` |
| Staff, Kram Snack | `staff@kramsnack.tn` | `Staff#2026` |
| Delivery, Dar Lella | `karim.d` or `amine.b` | `Delivery#2026` |
| Admin | `admin@foodgo.tn` | `Admin#2026` |

Dar Lella's demo deadline is 23:30 so you can order at almost any time. Kram Snack closes at 10:30, so after that you can see a late order being refused.

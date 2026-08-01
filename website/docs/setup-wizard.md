# Setup Wizard

The Setup Wizard connects Scout EA to Microsoft Scout and installs everything Scout
needs to run — in two short steps. You'll find it in the dashboard: click the sparkle
icon (:material-star-four-points:) in the top bar.

!!! info "Before you begin"
    - Scout EA is running and you can see the dashboard in your browser.
    - You have Microsoft Scout open and ready to receive messages.

---

## Step 1 — Connect Scout

This introduces Scout to your dashboard. You only do it once.

1. In Scout, open **Settings → MCP servers** and choose **Add server**.
2. The wizard shows you three things to fill in and copy across — click the copy
   button next to each and paste it into the matching box in Scout:
      1. **Name** — a label for this connection (you can change it, or leave the default).
      2. **Address** — where Scout should send its requests.
      3. **Token** — a password that proves it's really your dashboard on the other end.
3. Once all three are filled in and saved in Scout, send Scout this message (there's a
   copy button for it too):

    > List your available tools

4. Wait a moment. When Scout has picked up the connection, a green tick appears on the
   page and it says **"Scout is connected."** Click **Next**.

If nothing turns green after a minute or two, double-check the address and token were
pasted in full, with no extra spaces.

---

## Step 2 — Set it up

This step installs everything: all 24 of Scout's automated jobs ("skills"), a
schedule for each one, and the list of tools Scout is allowed to use.

You don't set any of this up by hand. Instead:

1. Click **Copy the setup message**.
2. Paste it into Scout and send it.
3. Scout reads the message and does the rest itself — no further clicks needed on
   your end.

While you wait, you can click **What will it set up?** to see the full list of jobs
Scout is about to configure, with a plain description of what each one does and how
often it runs.

When Scout finishes, a green confirmation — **"Scout picked it up. You're all set."**
— appears on the page by itself. That's it; click **Finish**.

!!! note "What's actually happening"
    The one message you paste tells Scout to fetch a bundle from your dashboard and
    write it into its own configuration: the 24 skill files, an entry in Scout's job
    list for each one, and an updated tool allow-list. You don't need to understand
    this to use the wizard — it's here in case you're curious or something looks off.

---

## If something goes wrong

**The green tick in Step 1 never appears** — make sure you pasted the Address and
Token exactly as copied, and that Scout's Add server dialog was actually saved.
Re-open the wizard and try again; it's safe to repeat.

**The confirmation in Step 2 never appears** — check that Scout actually received and
ran the pasted message (look for its reply in the Scout chat). If Scout reports an
error partway through, tell it to retry — the setup message is safe to re-run and
won't create duplicates.

**A skill isn't running** — open the dashboard and check the tile it feeds. If it's
empty after the skill's schedule should have fired at least once, re-send the Step 2
message; Scout will re-check and fix anything that didn't take.

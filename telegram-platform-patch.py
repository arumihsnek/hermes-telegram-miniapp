# This file documents the patch applied to /opt/hermes/gateway/platforms/telegram.py
# to implement /resume <id> command with session ID prefix resolution.
#
# The entire file is maintained at:
#   /opt/hermes_code/gateway/platforms/telegram.py (persistent)
#   /opt/hermes/gateway/platforms/telegram.py (in running container)
#
# This snippet shows the key change in _handle_command():

"""
    async def _handle_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        \"\"\"Handle incoming command messages.\"\"\"
        if not update.message or not update.message.text:
            return
        if not self._should_process_message(update.message, is_command=True):
            return

        # Intercept /skill-menu for native inline keyboard menu
        text = update.message.text.strip().split()[0].lower()
        if text in ("/skill-menu", "/skill_menu"):
            chat_id = str(update.message.chat_id)
            thread_id = update.message.message_thread_id
            await self.send_category_menu(chat_id, thread_id)
            return

        # ===== NEW CODE BLOCK =====
        # Intercept /resume <id_prefix> from Mini App buttons (ID-based lookup)
        if text in ("/resume",) or text.startswith("/resume@"):
            parts = update.message.text.strip().split(None, 1)
            arg = parts[1].strip() if len(parts) > 1 else ""
            if arg:
                runner = getattr(self._message_handler, "__self__", None)
                session_db = getattr(runner, "_session_db", None) if runner else None
                if session_db is not None:
                    full_id = session_db.resolve_session_id(arg)
                    if full_id:
                        event = self._build_message_event(update.message, MessageType.COMMAND, update_id=update.update_id)
                        session_key = runner._session_key_for_source(event.source)
                        try:
                            full_id = session_db.resolve_resume_session_id(full_id)
                        except Exception:
                            pass
                        current = runner.session_store.get_or_create_session(event.source)
                        if current.session_id == full_id:
                            title = session_db.get_session_title(full_id) or arg
                            await update.message.reply_text(f"📌 Already on session *{title}*.", parse_mode="Markdown")
                            return
                        runner._release_running_agent_state(session_key)
                        new_entry = runner.session_store.switch_session(session_key, full_id)
                        if not new_entry:
                            await update.message.reply_text("Failed to switch session.")
                            return
                        try:
                            runner._clear_session_boundary_security_state(session_key)
                        except Exception:
                            pass
                        try:
                            runner._evict_cached_agent(session_key)
                        except Exception:
                            pass
                        title = session_db.get_session_title(full_id) or arg
                        history = runner.session_store.load_transcript(full_id)
                        msg_count = len([m for m in history if m.get("role") == "user"]) if history else 0
                        msg_part = f" ({msg_count} message{'s' if msg_count != 1 else ''})" if msg_count else ""
                        await update.message.reply_text(
                            f"↻ Resumed session *{title}*{msg_part}. Conversation restored.",
                            parse_mode="Markdown",
                        )
                        return
        # ===== END NEW CODE BLOCK =====

        event = self._build_message_event(update.message, MessageType.COMMAND, update_id=update.update_id)
        await self.handle_message(event)
"""

# Location in file: _handle_command() method (async), after /skill-menu intercept
# Line range: approximately 3333-3376 (exact line may vary with other changes)

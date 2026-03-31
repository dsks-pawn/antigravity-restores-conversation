import './suppress-warnings';
import {
  intro,
  outro,
  spinner,
  confirm,
  note,
  isCancel,
  cancel,
} from '@clack/prompts';
import pc from 'picocolors';
import {
  scan,
  autoAssignWorkspaces,
  fix,
  ConversationInfo,
} from '../core/fixer';

async function waitForKeypress() {
  console.log(pc.dim('\nNhấn phím bất kỳ để thoát...'));
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve) => process.stdin.once('data', resolve));
}

async function main() {
  const isAutoFix = process.argv.includes('--auto-fix');
  const isScanJson = process.argv.includes('--scan-json');

  if (isScanJson) {
    try {
      const convs = scan({ onLog: () => {} });
      console.log(JSON.stringify(convs));
    } catch (e: any) {
      console.error(JSON.stringify({ error: e.message }));
      process.exit(1);
    }
    process.exit(0);
  }

  if (isAutoFix) {
    try {
      const convs = scan({ onLog: () => {} });
      const assigns = autoAssignWorkspaces(convs, { onLog: () => {} });
      fix(convs, assigns, { onLog: () => {} });
    } catch (e: any) {
      process.exit(1);
    }
    process.exit(0);
  }

  console.clear();

  // ASCII ART Banner
  console.log(
    pc.magenta(`
   _____        __  _                     _ __       
  /  _  \\____ _/  |(_)___________ __   __(_) /___  __
 /  /_\\  \\__ \\\\   __\\  \\_  __ \\  |  \\ /  /  /  \\ \\/ /
/    |    \\/ __ \\_  |  |  |  \\/ \\___  /|  |  |  \\   / 
\\____|__  (____  /__|  |__|   / ____/ |__|__|   \\_/  
        \\/     \\/             \\/                     
    `),
  );

  intro(
    pc.bgMagenta(pc.white(' \u2728 ANTIGRAVITY RESTORES CONVERSATION \u2728 ')),
  );

  note(
    'Công cụ quyền năng này sẽ can thiệp trực tiếp vào SQLite database của IDE.\n' +
      pc.bgRed(
        pc.white(
          ' \u26A0\ufe0f BẠN BẮT BUỘC PHẢI TẮT HOÀN TOÀN ANTIGRAVITY IDE TRƯỚC KHI TIẾP TỤC! ',
        ),
      ),
    'CẢNH BÁO BẢO MẬT',
  );

  const ready = await confirm({
    message: pc.cyan('Bạn đã chắc chắn tắt hoàn toàn Antigravity chưa?'),
    initialValue: false,
  });

  if (isCancel(ready) || !ready) {
    cancel(
      pc.yellow(
        'Đã hủy thao tác. Vui lòng tắt Antigravity và mở lại chương trình.',
      ),
    );
    await waitForKeypress();
    process.exit(0);
  }

  const s = spinner();
  s.start(
    pc.blue('Đang quét sâu vào thư mục Hệ thống tìm kiếm Conversation...'),
  );

  let conversations: ConversationInfo[] = [];
  try {
    conversations = scan({
      onLog: (msg) => {},
    });
    s.stop(
      pc.green(
        `\u2714 Quét hoàn tất: Bắt được ${pc.bold(pc.yellow(conversations.length))} conversations đi lạc.`,
      ),
    );
  } catch (error: any) {
    s.stop(pc.red('\u2716 Lỗi nghiêm trọng khi quét file!'));
    cancel(error.message);
    await waitForKeypress();
    process.exit(1);
  }

  if (conversations.length === 0) {
    outro(
      pc.yellow(
        '\u26A0\ufe0f Không tìm thấy dữ liệu conversation nào. Hẹn gặp lại!',
      ),
    );
    await waitForKeypress();
    process.exit(0);
  }

  const proceed = await confirm({
    message: pc.cyan(
      'Bạn có muốn kích hoạt cỗ máy khôi phục hiển thị Sidebar không?',
    ),
    initialValue: true,
  });

  if (isCancel(proceed) || !proceed) {
    cancel(pc.yellow('Đã huỷ thao tác khôi phục. Cỗ máy tạm dừng.'));
    await waitForKeypress();
    process.exit(0);
  }

  s.start(
    pc.magenta('Đang tự động map Workspace vả xây dựng lại Index SQLite...'),
  );

  try {
    const assignments = autoAssignWorkspaces(conversations);
    const result = fix(conversations, assignments);

    s.stop(
      pc.green(
        `\u2714 THÀNH CÔNG RỰC RỠ! Đã hồi sinh ${pc.bold(result.total)} cuộc hội thoại.`,
      ),
    );

    note(
      pc.cyan(`\u25B6 Lấy từ bộ nhớ Brain: `) +
        pc.white(result.bySource.brain) +
        '\n' +
        pc.cyan(`\u25B6 Giữ nguyên lịch sử cũ: `) +
        pc.white(result.bySource.preserved) +
        '\n' +
        pc.cyan(`\u25B6 Tự động phân loại (Fallback): `) +
        pc.white(result.bySource.fallback) +
        '\n\n' +
        pc.green(`\u2714 Tổng Workspace map chuẩn xác: `) +
        pc.white(result.workspacesMapped) +
        '\n' +
        (result.backupPath
          ? pc.dim(`\uD83D\uDCBE Bản sao lưu an toàn: ${result.backupPath}`)
          : ''),
      'BÁO CÁO NHIỆM VỤ',
    );

    outro(
      pc.bgGreen(
        pc.black(
          ' \uD83C\uDF89 HOÀN TẤT! BẠN CÓ THỂ MỞ LẠI ANTIGRAVITY IDE NGAY BÂY GIỜ! ',
        ),
      ),
    );
    await waitForKeypress();
    process.exit(0);
  } catch (error: any) {
    if (error.message === 'DB_LOCKED') {
      s.stop(
        pc.bgRed(
          pc.white(' \u26A0\ufe0f LỖI: DATABASE ĐANG BỊ KHÓA (SQLITE_BUSY) '),
        ),
      );
      cancel(
        pc.yellow(
          'Antigravity IDE vẫn còn đang chạy ngầm hoặc chưa được tắt hoàn toàn. Vui lòng tắt sạch các tiến trình "code.exe" trong Task Manager và thử chạy lại script này.',
        ),
      );
    } else {
      s.stop(pc.bgRed(pc.white(' \u2716 ĐÃ CÓ LỖI XẢY RA KHI CAN THIỆP DB ')));
      cancel(error.message);
    }
    await waitForKeypress();
    process.exit(1);
  }
}

main().catch(console.error);

import path from "path";
import pc from "picocolors";

export function handleScheduleHelp(): void {
  const isWindows = process.platform === "win32";
  const projectDir = process.cwd();
  const nodeExe = process.execPath;
  const scriptPath = path.resolve(projectDir, "dist", "bin", "slothwatch.js");

  console.log(pc.bold("\n🦥 SlothWatch Automated Scheduling Guide"));
  console.log(pc.dim("━".repeat(78)));
  console.log(
    "SlothWatch is designed for lazy, set-and-forget background execution.\n" +
    "Below are the recommended automated schedule commands for your operating system:\n" +
    `Detected OS: ${pc.cyan(process.platform)} (${isWindows ? "Windows" : "Unix/macOS/Linux"})\n`
  );

  if (isWindows) {
    console.log(pc.bold(pc.green("1. Windows Task Scheduler (Recommended via schtasks.exe):")));
    console.log("   Run the following in an Administrator Command Prompt or PowerShell:\n");

    const schtaskCmd = `schtasks /create /tn "SlothWatch" /tr "\\"${nodeExe}\\" \\"${scriptPath}\\" run-all" /sc hourly /f`;
    console.log(pc.cyan(`   ${schtaskCmd}\n`));

    console.log(pc.bold(pc.green("2. Alternative: PowerShell Scheduled Task:")));
    console.log("   $action = New-ScheduledTaskAction -Execute \"" + nodeExe + "\" -Argument '\"" + scriptPath + "\" run-all'");
    console.log("   $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)");
    console.log("   Register-ScheduledTask -TaskName \"SlothWatch\" -Action $action -Trigger $trigger -Description \"SlothWatch hourly watcher\"\n");

    console.log(pc.bold("To test the scheduled task immediately:"));
    console.log(pc.dim("   schtasks /run /tn \"SlothWatch\"\n"));

    console.log(pc.bold("To remove the scheduled task:"));
    console.log(pc.dim("   schtasks /delete /tn \"SlothWatch\" /f\n"));
  } else {
    console.log(pc.bold(pc.green("Linux / macOS crontab:")));
    console.log("   Edit your user crontab by running: " + pc.cyan("crontab -e"));
    console.log("   Add the following line to run SlothWatch at the top of every hour:\n");

    const cronLine = `0 * * * * cd "${projectDir}" && "${nodeExe}" "${scriptPath}" run-all >> "${projectDir}/slothwatch.log" 2>&1`;
    console.log(pc.cyan(`   ${cronLine}\n`));

    console.log(pc.bold("To view your active cron jobs:"));
    console.log(pc.dim("   crontab -l\n"));
  }

  console.log(pc.bold("Key Scheduling Features:"));
  console.log(` • ${pc.bold("Interval Guard:")} slothwatch run-all skips any watch checked within the last hour (configurable with ${pc.cyan("--interval <mins>")}).`);
  console.log(` • ${pc.bold("Force Override:")} Pass ${pc.cyan("--force")} to ignore minimum interval rules when testing.`);
  console.log(` • ${pc.bold("Fault Isolation:")} A network error on one page will never halt checks for the remaining pages.\n`);
  console.log(pc.dim("Note: SlothWatch does not install background schedules automatically. Run the command above when ready.\n"));
}

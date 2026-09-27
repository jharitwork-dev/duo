// Builds flat row arrays for Google Sheets from a registration payload.
// Each team member becomes one row. The team name and registration ID
// are repeated on every row for easy filtering.
//
// Columns: A=timestamp, B=registrationId, C=teamName, D=memberNumber,
// E=totalMembers, F=fullName, G=nickname, H=age, I=educationLevel,
// J=institution, K=phone, L=lineId, M=email

import type { RegistrationInput } from './schema';

export function buildRegistrationRows(
  registrationId: string,
  data: RegistrationInput,
  timestamp: string,
): string[][] {
  return data.members.map((member, i) => {
    const eduLevel =
      member.educationLevel === 'อื่นๆ' && member.educationLevelOther
        ? `อื่นๆ (${member.educationLevelOther})`
        : member.educationLevel;

    return [
      timestamp,                          // A: timestamp
      registrationId,                     // B: registrationId
      data.teamName,                      // C: teamName
      String(i + 1),                      // D: memberNumber
      String(data.members.length),        // E: totalMembers
      member.fullName,                    // F: fullName
      member.nickname,                    // G: nickname
      String(member.age),                 // H: age
      eduLevel,                           // I: educationLevel
      member.institution,                 // J: institution
      member.phone,                       // K: phone
      member.lineId ?? '',                // L: lineId
      member.email,                       // M: email
    ];
  });
}

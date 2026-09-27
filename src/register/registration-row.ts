// Builds flat row arrays for Google Sheets from a registration payload.
// Each team member becomes one row. The team name and registration ID
// are repeated on every row for easy filtering.
//
// Columns: A=timestamp, B=registrationId, C=teamName, D=productDescription,
// E=memberNumber, F=totalMembers, G=fullName, H=nickname, I=age,
// J=educationLevel, K=institution, L=phone, M=lineId, N=email

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
      data.productDescription,            // D: productDescription
      String(i + 1),                      // E: memberNumber
      String(data.members.length),        // F: totalMembers
      member.fullName,                    // G: fullName
      member.nickname,                    // H: nickname
      String(member.age),                 // I: age
      eduLevel,                           // J: educationLevel
      member.institution,                 // K: institution
      member.phone,                       // L: phone
      member.lineId ?? '',                // M: lineId
      member.email,                       // N: email
    ];
  });
}

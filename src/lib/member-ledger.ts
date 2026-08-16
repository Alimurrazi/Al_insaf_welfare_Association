import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";
import { listDepositsForMember } from "./deposits";
import { listTopupsForMember } from "./topups";
import { getShareCountAsOf, listMemberShares } from "./member-shares";

export async function getMemberLedger(memberId: string, asOfDate: Date) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new MemberNotFoundError(memberId);
  }

  const [deposits, topups, shareHistory] = await Promise.all([
    listDepositsForMember(memberId),
    listTopupsForMember(memberId),
    listMemberShares(memberId),
  ]);

  const totalPaid =
    deposits.reduce((sum, deposit) => sum + Number(deposit.amount), 0) +
    topups.reduce((sum, topup) => sum + Number(topup.amount), 0);

  return {
    member,
    deposits,
    topups,
    shareHistory,
    currentShareCount: getShareCountAsOf(shareHistory, asOfDate),
    totalPaid,
  };
}

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { User } from "@/types/api";

/** Basic account details — one of the three sections the brief asks for. */
export function UserCard({ user }: { user: User }) {
  const details = [
    { label: "Name", value: user.full_name },
    { label: "Email", value: user.email },
    { label: "Joined", value: formatDate(user.created_at) },
  ];

  return (
    <Card>
      <CardHeader title="Your account" />
      <CardBody>
        {/* A description list, not a table: these are label/value pairs, and
            <dl> is what conveys that relationship to a screen reader. */}
        <dl className="space-y-3">
          {details.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="truncate text-sm text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

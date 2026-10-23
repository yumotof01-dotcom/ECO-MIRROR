import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";

export function NotFoundPage() {
  return (
    <div className="inner-page not-found">
      <PageHeading
        eyebrow="404 / OFF THE TRAIL"
        title="ページが見つかりません。"
      >
        URLを確認するか、ホームからもう一度お進みください。
      </PageHeading>
      <Link to="/" className="button button-primary">
        ホームへ戻る
        <Icon name="arrow" />
      </Link>
    </div>
  );
}

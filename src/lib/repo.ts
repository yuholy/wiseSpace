export const APP_REPO_URL = __APP_REPO_URL__;
export const APP_REPO_HOST_LABEL = __APP_REPO_HOST_LABEL__;
export const APP_REPO_IS_GITHUB = __APP_REPO_IS_GITHUB__;

export function getRepoActionUrl(action: "repo" | "feature" | "bug" | "star"): string {
  if (!APP_REPO_IS_GITHUB) {
    return APP_REPO_URL;
  }

  switch (action) {
    case "feature":
      return `${APP_REPO_URL}/issues/new?labels=enhancement&template=feature_request.yml`;
    case "bug":
      return `${APP_REPO_URL}/issues/new?labels=bug&template=bug_report.yml`;
    case "star":
    case "repo":
    default:
      return APP_REPO_URL;
  }
}

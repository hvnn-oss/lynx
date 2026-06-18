import { RequestRegisterDto } from "@repo/dto";
export default function SignupForm() {
  const payload: RequestRegisterDto = {
    name: "",
    password: "",
    token: "",
    organization_info: {
      name: "",
    },
  };
  return <div></div>;
}

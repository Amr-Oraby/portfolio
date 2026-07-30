import Logo from "./Logo";
import NavControls from "./NavControls";
import Sections from "./Sections";

function Navbar() {
  // color 242424
  return (
    <nav className="flex justify-between items-center  px-5 py-7 sm:px-10">
      <Logo />
      <Sections />
      <NavControls />
    </nav>
  );
}

export default Navbar;

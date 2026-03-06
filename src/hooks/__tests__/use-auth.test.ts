import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock("@/actions", () => ({
  signIn: mockSignIn,
  signUp: mockSignUp,
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: mockGetAnonWorkData,
  clearAnonWork: mockClearAnonWork,
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: mockGetProjects,
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: mockCreateProject,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

async function importHook() {
  const { useAuth } = await import("@/hooks/use-auth");
  return useAuth;
}

describe("useAuth — signIn", () => {
  test("returns isLoading=false initially", async () => {
    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("sets isLoading=false after signing in", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("calls signInAction with email and password", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("test@example.com", "secret");
    });

    expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "secret");
  });

  test("returns the result from signInAction", async () => {
    const mockResult = { success: false, error: "Invalid credentials" };
    mockSignIn.mockResolvedValue(mockResult);
    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "wrong");
    });

    expect(returnValue).toEqual(mockResult);
  });

  test("does not redirect on sign-in failure", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Bad" });
    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "wrong");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("useAuth — signUp", () => {
  test("calls signUpAction with email and password", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email taken" });
    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "pass");
    });

    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "pass");
  });

  test("returns the result from signUpAction", async () => {
    const mockResult = { success: false, error: "Email taken" };
    mockSignUp.mockResolvedValue(mockResult);
    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("a@b.com", "pass");
    });

    expect(returnValue).toEqual(mockResult);
  });

  test("does not redirect on sign-up failure", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Bad" });
    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "pass");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("useAuth — post sign-in routing", () => {
  test("migrates anon work into a new project and redirects", async () => {
    const anonWork = {
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/app.tsx": { type: "file", content: "..." } },
    };
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockSignIn.mockResolvedValue({ success: true });
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
  });

  test("redirects to most recent project when no anon work", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "existing-id" }, { id: "older-id" }]);

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/existing-id");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("creates a new project and redirects when no anon work and no projects", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-id" });

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
  });

  test("ignores anon work with no messages and falls through to projects", async () => {
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "project-id" }]);

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/project-id");
  });

  test("same post-sign-in routing applies after signUp", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "signup-project" }]);

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/signup-project");
  });
});
